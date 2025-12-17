import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, or, inArray } from 'drizzle-orm';
import { logCustomerDelete } from '@/lib/services/changeHistory';

/**
 * Permanently delete a customer and all associated data
 * This action cannot be undone
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;
    console.log(`[POST /api/customers/${customerId}/permanent-delete] Permanently deleting customer...`);

    // Check if customer exists
    const customerRows = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.dbxCustomerId, customerId))
      .limit(1);
    const customer = customerRows[0];

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Log permanent deletion before deleting (must be done before customer is deleted)
    await logCustomerDelete(customerId, customer.clientName || 'Unknown Customer');

    // Get all orders for this customer
    const orders = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.customerId, customerId));

    const orderIds = orders.map(order => order.id);

    // Get all order items for these orders (needed for change history deletion)
    let orderItemIds: string[] = [];
    if (orderIds.length > 0) {
      const orderItems = await db
        .select()
        .from(schema.orderItems)
        .where(inArray(schema.orderItems.orderId, orderIds));
      orderItemIds = orderItems.map(item => item.id);
    }

    // Delete all related data in order (respecting foreign key constraints):
    // 1. Alert Acknowledgments (references customers)
    try {
      await db.delete(schema.alertAcknowledgments)
        .where(eq(schema.alertAcknowledgments.customerId, customerId));
      console.log(`[PERMANENT-DELETE] Deleted alert acknowledgments for customer ${customerId}`);
    } catch (error) {
      // Table might not exist in all environments, log but continue
      console.warn(`[PERMANENT-DELETE] Could not delete alert acknowledgments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 2. Change History - MUST be deleted before order items (references orderItemId)
    // Delete all change history entries that reference:
    // - Order items (via orderItemId)
    // - Orders (via orderId)
    // - Customer (via customerId)
    const changeHistoryConditions = [eq(schema.changeHistory.customerId, customerId)];
    
    if (orderIds.length > 0) {
      changeHistoryConditions.push(inArray(schema.changeHistory.orderId, orderIds));
    }
    
    if (orderItemIds.length > 0) {
      changeHistoryConditions.push(inArray(schema.changeHistory.orderItemId, orderItemIds));
    }

    await db.delete(schema.changeHistory)
      .where(or(...changeHistoryConditions));
    console.log(`[PERMANENT-DELETE] Deleted change history for customer ${customerId} (${orderIds.length} orders, ${orderItemIds.length} order items)`);

    // 3. Invoices (via orders)
    for (const order of orders) {
      await db.delete(schema.invoices)
        .where(eq(schema.invoices.orderId, order.id));
    }
    console.log(`[PERMANENT-DELETE] Deleted invoices for ${orders.length} order(s)`);

    // 4. Order Items (via orders) - Now safe to delete since change history is gone
    for (const order of orders) {
      await db.delete(schema.orderItems)
        .where(eq(schema.orderItems.orderId, order.id));
    }
    console.log(`[PERMANENT-DELETE] Deleted order items for ${orders.length} order(s)`);

    // 5. Orders
    await db.delete(schema.orders)
      .where(eq(schema.orders.customerId, customerId));
    console.log(`[PERMANENT-DELETE] Deleted ${orders.length} order(s) for customer ${customerId}`);

    // 6. Finally, delete the customer
    await db.delete(schema.customers)
      .where(eq(schema.customers.dbxCustomerId, customerId));

    console.log(`[POST /api/customers/${customerId}/permanent-delete] Customer permanently deleted successfully`);
    return NextResponse.json({ 
      success: true, 
      message: 'Customer and all associated data permanently deleted successfully'
    });
  } catch (error) {
    console.error('Error permanently deleting customer:', error);
    return NextResponse.json(
      {
        error: 'Failed to permanently delete customer',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
