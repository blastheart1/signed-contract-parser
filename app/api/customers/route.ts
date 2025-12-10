import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, isNull, and, or, isNotNull, desc } from 'drizzle-orm';
import { validateOrderItemsTotal } from '@/lib/orderItemsValidation';
import { updateCustomerStatus } from '@/lib/services/customerStatus';
import type { OrderItem } from '@/lib/tableExtractor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const includeDeleted = searchParams.get('includeDeleted') === 'true';
    const trashOnly = searchParams.get('trashOnly') === 'true';

    // Build where clause based on filters
    let whereClause;
    
    if (trashOnly) {
      // Only show deleted customers (in trash)
      whereClause = isNotNull(schema.customers.deletedAt);
    } else if (!includeDeleted) {
      // Default: exclude deleted customers
      whereClause = isNull(schema.customers.deletedAt);
    } else {
      // Include all (deleted and non-deleted)
      whereClause = undefined;
    }

    // Add status filter if provided
    if (status && status !== 'all') {
      const statusFilter = eq(schema.customers.status, status as 'pending_updates' | 'completed');
      whereClause = whereClause 
        ? and(whereClause, statusFilter)
        : statusFilter;
    }

    // Fetch customers with filters, sorted by latest modified (updatedAt descending)
    // NOTE: If you get an error about 'deleted_at' column, run: npx drizzle-kit push
    const customers = await db
      .select()
      .from(schema.customers)
      .where(whereClause)
      .orderBy(desc(schema.customers.updatedAt));

    // For each customer, get order count, stage, and check for validation issues
    const customersWithCounts = await Promise.all(
      customers.map(async (customer) => {
        const ordersList = await db
          .select()
          .from(schema.orders)
          .where(eq(schema.orders.customerId, customer.dbxCustomerId))
          .orderBy(desc(schema.orders.createdAt));
        
        const orders = ordersList;

        // Get stage from most recent order
        const mostRecentOrder = orders.length > 0 ? orders[0] : null;
        const stage = mostRecentOrder?.stage || null;

        // If stage is 'completed' but status is not 'completed', update the status
        if (stage === 'completed' && customer.status !== 'completed') {
          try {
            await updateCustomerStatus(customer.dbxCustomerId);
            // Refresh customer to get updated status
            const updatedCustomer = await db.query.customers.findFirst({
              where: eq(schema.customers.dbxCustomerId, customer.dbxCustomerId),
            });
            if (updatedCustomer) {
              customer.status = updatedCustomer.status;
            }
          } catch (error) {
            console.error(`Error updating customer ${customer.dbxCustomerId} status:`, error);
          }
        }

        // Check for validation issues in orders
        let hasValidationIssues = false;
        const validationIssues: string[] = [];

        // Check if alerts are acknowledged
        const acknowledgments = await db.query.alertAcknowledgments.findMany({
          where: eq(schema.alertAcknowledgments.customerId, customer.dbxCustomerId),
        });
        const acknowledgedAlertTypes = new Set(acknowledgments.map(ack => ack.alertType));

        for (const order of orders) {
          // Get order items for this order
          const orderItems = await db.query.orderItems.findMany({
            where: eq(schema.orderItems.orderId, order.id),
            orderBy: schema.orderItems.rowIndex,
          });

          // Convert to OrderItem format for validation
          const items: OrderItem[] = orderItems.map((item) => ({
            type: item.itemType,
            productService: item.productService,
            qty: item.qty ? parseFloat(item.qty) : '',
            rate: item.rate ? parseFloat(item.rate) : '',
            amount: item.amount ? parseFloat(item.amount) : '',
            mainCategory: item.mainCategory || undefined,
            subCategory: item.subCategory || undefined,
          }));

          // Validate order items total
          const validation = validateOrderItemsTotal(items, parseFloat(order.orderGrandTotal));
          if (!validation.isValid) {
            // Only mark as validation issue if the alert type is not acknowledged
            const alertType = 'order_items_mismatch';
            if (!acknowledgedAlertTypes.has(alertType)) {
              hasValidationIssues = true;
              validationIssues.push(`Order ${order.orderNo}: Items total mismatch`);
            }
          }
        }

        return {
          id: customer.dbxCustomerId,
          dbxCustomerId: customer.dbxCustomerId,
          clientName: customer.clientName,
          email: customer.email,
          phone: customer.phone,
          streetAddress: customer.streetAddress,
          city: customer.city,
          state: customer.state,
          zip: customer.zip,
          status: customer.status,
          stage: stage,
          contractCount: orders.length,
          hasValidationIssues,
          validationIssues: validationIssues.length > 0 ? validationIssues : undefined,
        };
      })
    );

    return NextResponse.json({ success: true, customers: customersWithCounts });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch customers',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

