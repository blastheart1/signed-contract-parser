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

    console.log('[Customers] Query params:', { status, includeDeleted, trashOnly, whereClause: whereClause ? 'defined' : 'undefined' });

    // Fetch customers with filters, sorted by latest modified (updatedAt descending)
    // NOTE: If you get an error about 'deleted_at' column, run: npx drizzle-kit push
    const customers = await db
      .select()
      .from(schema.customers)
      .where(whereClause)
      .orderBy(desc(schema.customers.updatedAt));

    console.log(`[Customers] Fetched ${customers.length} customers from database`);

    if (customers.length === 0) {
      console.log('[Customers] No customers found, returning empty array');
      return NextResponse.json({ success: true, customers: [] });
    }

    // Batch fetch all related data to avoid N+1 queries
    const customerIds = customers.map(c => c.dbxCustomerId);

    // Fetch all orders for all customers in one query (only if we have customerIds)
    const allOrders = customerIds.length > 0
      ? await db
          .select()
          .from(schema.orders)
          .where(inArray(schema.orders.customerId, customerIds))
          .orderBy(desc(schema.orders.createdAt))
      : [];

    // Group orders by customerId
    const ordersByCustomerId = new Map<string, typeof allOrders>();
    for (const order of allOrders) {
      if (!ordersByCustomerId.has(order.customerId)) {
        ordersByCustomerId.set(order.customerId, []);
      }
      ordersByCustomerId.get(order.customerId)!.push(order);
    }

    // Get all order IDs for batch fetching order items
    const allOrderIds = allOrders.map(o => o.id);

    // Batch fetch all order items for all orders
    const allOrderItems = allOrderIds.length > 0
      ? await db
          .select()
          .from(schema.orderItems)
          .where(inArray(schema.orderItems.orderId, allOrderIds))
          .orderBy(schema.orderItems.rowIndex)
      : [];

    // Group order items by orderId
    const orderItemsByOrderId = new Map<string, typeof allOrderItems>();
    for (const item of allOrderItems) {
      if (!orderItemsByOrderId.has(item.orderId)) {
        orderItemsByOrderId.set(item.orderId, []);
      }
      orderItemsByOrderId.get(item.orderId)!.push(item);
    }

    // Batch fetch all alert acknowledgments (only if we have customerIds)
    const allAcknowledgments = customerIds.length > 0
      ? await db
          .select()
          .from(schema.alertAcknowledgments)
          .where(inArray(schema.alertAcknowledgments.customerId, customerIds))
      : [];

    // Group acknowledgments by customerId
    const acknowledgmentsByCustomerId = new Map<string, typeof allAcknowledgments>();
    for (const ack of allAcknowledgments) {
      if (!acknowledgmentsByCustomerId.has(ack.customerId)) {
        acknowledgmentsByCustomerId.set(ack.customerId, []);
      }
      acknowledgmentsByCustomerId.get(ack.customerId)!.push(ack);
    }

    // Process customers with batched data
    const customersWithCounts = await Promise.all(
      customers.map(async (customer) => {
        const orders = ordersByCustomerId.get(customer.dbxCustomerId) || [];

        // Get stage from most recent order
        const mostRecentOrder = orders.length > 0 ? orders[0] : null;
        const stage = mostRecentOrder?.stage || null;

        // If stage is 'completed' but status is not 'completed', update the status
        if (stage === 'completed' && customer.status !== 'completed') {
          try {
            await updateCustomerStatus(customer.dbxCustomerId);
            // Refresh customer to get updated status
            const updatedCustomerRows = await db
              .select()
              .from(schema.customers)
              .where(eq(schema.customers.dbxCustomerId, customer.dbxCustomerId))
              .limit(1);
            const updatedCustomer = updatedCustomerRows[0];
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

        // Get acknowledgments for this customer
        const acknowledgments = acknowledgmentsByCustomerId.get(customer.dbxCustomerId) || [];
        const acknowledgedAlertTypes = new Set(acknowledgments.map(ack => ack.alertType));

        for (const order of orders) {
          // Get order items for this order from the batched data
          const orderItems = orderItemsByOrderId.get(order.id) || [];

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
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      {
        error: 'Failed to fetch customers',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

