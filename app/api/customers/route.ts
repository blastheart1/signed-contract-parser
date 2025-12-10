import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, isNull, and, or, isNotNull, desc, inArray } from 'drizzle-orm';
import { validateOrderItemsTotal } from '@/lib/orderItemsValidation';
import { updateCustomerStatus } from '@/lib/services/customerStatus';
import type { OrderItem } from '@/lib/tableExtractor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const includeDeleted = searchParams.get('includeDeleted') === 'true';
    const trashOnly = searchParams.get('trashOnly') === 'true';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '1000', 10); // Default high limit for backward compatibility

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
    const allCustomers = await db
      .select()
      .from(schema.customers)
      .where(whereClause)
      .orderBy(desc(schema.customers.updatedAt));

    // Apply pagination
    const totalCustomers = allCustomers.length;
    const offset = (page - 1) * limit;
    const customers = allCustomers.slice(offset, offset + limit);

    if (customers.length === 0) {
      return NextResponse.json({ 
        success: true, 
        customers: [],
        pagination: {
          page,
          limit,
          total: totalCustomers,
          totalPages: Math.ceil(totalCustomers / limit)
        }
      });
    }

    // Get all customer IDs for batch fetching
    const customerIds = customers.map(c => c.dbxCustomerId);

    // Batch fetch all orders for all customers in one query
    const allOrders = customerIds.length > 0 
      ? await db
          .select()
          .from(schema.orders)
          .where(inArray(schema.orders.customerId, customerIds))
          .orderBy(desc(schema.orders.createdAt))
      : [];

    // Group orders by customer ID
    const ordersByCustomer = new Map<string, typeof schema.orders.$inferSelect[]>();
    for (const order of allOrders) {
      const existing = ordersByCustomer.get(order.customerId) || [];
      existing.push(order);
      ordersByCustomer.set(order.customerId, existing);
    }

    // Batch fetch all alert acknowledgments in one query
    const allAcknowledgments = customerIds.length > 0
      ? await db
          .select()
          .from(schema.alertAcknowledgments)
          .where(inArray(schema.alertAcknowledgments.customerId, customerIds))
      : [];

    // Group acknowledgments by customer ID
    const acknowledgmentsByCustomer = new Map<string, Set<string>>();
    for (const ack of allAcknowledgments) {
      if (!acknowledgmentsByCustomer.has(ack.customerId)) {
        acknowledgmentsByCustomer.set(ack.customerId, new Set());
      }
      acknowledgmentsByCustomer.get(ack.customerId)!.add(ack.alertType);
    }

    // Get all order IDs for batch fetching order items
    const orderIds = allOrders.map(o => o.id);

    // Batch fetch all order items in one query
    const allOrderItems = orderIds.length > 0
      ? await db
          .select()
          .from(schema.orderItems)
          .where(inArray(schema.orderItems.orderId, orderIds))
          .orderBy(schema.orderItems.rowIndex)
      : [];

    // Group order items by order ID
    const orderItemsByOrder = new Map<string, typeof schema.orderItems.$inferSelect[]>();
    for (const item of allOrderItems) {
      const existing = orderItemsByOrder.get(item.orderId) || [];
      existing.push(item);
      orderItemsByOrder.set(item.orderId, existing);
    }

    // Process customers with their related data
    const customersWithCounts = await Promise.all(
      customers.map(async (customer) => {
        const orders = ordersByCustomer.get(customer.dbxCustomerId) || [];

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

        // Get acknowledged alert types for this customer
        const acknowledgedAlertTypes = acknowledgmentsByCustomer.get(customer.dbxCustomerId) || new Set<string>();

        for (const order of orders) {
          // Get order items for this order from the pre-fetched map
          const orderItems = orderItemsByOrder.get(order.id) || [];

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

    return NextResponse.json({ 
      success: true, 
      customers: customersWithCounts,
      pagination: {
        page,
        limit,
        total: totalCustomers,
        totalPages: Math.ceil(totalCustomers / limit)
      }
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
      }
    });
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

