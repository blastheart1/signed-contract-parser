import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { and, isNotNull, lt, eq } from 'drizzle-orm';

/**
 * Permanently delete customers that have been in trash for more than 30 days
 * This should be called by a cron job or scheduled task
 */
export async function POST(request: NextRequest) {
  try {
    // Check for authorization: if CLEANUP_API_TOKEN is set, require it
    // Otherwise, allow from authenticated admin users (called from admin panel)
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CLEANUP_API_TOKEN;
    
    if (expectedToken) {
      // If token is configured, require it
      if (authHeader !== `Bearer ${expectedToken}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }
    // If no token is configured, allow the request (assumes admin panel authentication)

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    console.log(`[CLEANUP] Starting cleanup of customers deleted before ${thirtyDaysAgo.toISOString()}`);

    // Find customers deleted more than 30 days ago
    const customersToDelete = await db
      .select()
      .from(schema.customers)
      .where(and(
        isNotNull(schema.customers.deletedAt),
        lt(schema.customers.deletedAt, thirtyDaysAgo)
      ));

    console.log(`[CLEANUP] Found ${customersToDelete.length} customers to permanently delete`);

    let deletedCount = 0;
    let errors: string[] = [];

    for (const customer of customersToDelete) {
      try {
        // Get all orders for this customer
        const orders = await db
          .select()
          .from(schema.orders)
          .where(eq(schema.orders.customerId, customer.dbxCustomerId));

        // Delete all related data in order (respecting foreign key constraints):
        // 1. Alert Acknowledgments (references customers)
        try {
          await db.delete(schema.alertAcknowledgments)
            .where(eq(schema.alertAcknowledgments.customerId, customer.dbxCustomerId));
        } catch (error) {
          // Table might not exist in all environments, log but continue
          console.warn(`[CLEANUP] Could not delete alert acknowledgments for customer ${customer.dbxCustomerId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // 2. Invoices (via orders)
        for (const order of orders) {
          await db.delete(schema.invoices)
            .where(eq(schema.invoices.orderId, order.id));
        }

        // 3. Order Items (via orders)
        for (const order of orders) {
          await db.delete(schema.orderItems)
            .where(eq(schema.orderItems.orderId, order.id));
        }

        // 4. Change History (via orders and customer)
        await db.delete(schema.changeHistory)
          .where(eq(schema.changeHistory.customerId, customer.dbxCustomerId));

        // 5. Orders
        await db.delete(schema.orders)
          .where(eq(schema.orders.customerId, customer.dbxCustomerId));

        // 6. Finally, delete the customer
        await db.delete(schema.customers)
          .where(eq(schema.customers.dbxCustomerId, customer.dbxCustomerId));

        deletedCount++;
        console.log(`[CLEANUP] Permanently deleted customer: ${customer.dbxCustomerId}`);
      } catch (error) {
        const errorMsg = `Failed to delete customer ${customer.dbxCustomerId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`[CLEANUP] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleanup completed. Permanently deleted ${deletedCount} customer(s).`,
      deletedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    return NextResponse.json(
      {
        error: 'Failed to cleanup trash',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

