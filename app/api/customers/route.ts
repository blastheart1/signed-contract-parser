import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, isNull, and, or, isNotNull } from 'drizzle-orm';
import { validateOrderItemsTotal } from '@/lib/orderItemsValidation';
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

    // Fetch customers with filters
    // NOTE: If you get an error about 'deleted_at' column, run: npx drizzle-kit push
    const customers = await db.query.customers.findMany({
      where: whereClause,
    });

    // For each customer, get order count and check for validation issues
    const customersWithCounts = await Promise.all(
      customers.map(async (customer) => {
        const orders = await db.query.orders.findMany({
          where: eq(schema.orders.customerId, customer.dbxCustomerId),
        });

        // Check for validation issues in orders
        let hasValidationIssues = false;
        const validationIssues: string[] = [];

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
            hasValidationIssues = true;
            validationIssues.push(`Order ${order.orderNo}: Items total mismatch`);
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

