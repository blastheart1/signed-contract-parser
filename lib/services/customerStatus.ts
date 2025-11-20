import { db } from '@/lib/db';
import { customers, orders, invoices } from '@/lib/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';

/**
 * Calculate customer status based on orders and invoices
 * - "pending_updates": Any order has status 'pending_updates' OR any invoice has open_balance > 0
 * - "completed": All orders are 'completed' AND all invoices are paid (open_balance = 0)
 */
export async function calculateCustomerStatus(dbxCustomerId: string): Promise<'pending_updates' | 'completed'> {
  try {
    // Get all orders for this customer
    const customerOrders = await db.query.orders.findMany({
      where: eq(orders.customerId, dbxCustomerId),
    });

    if (customerOrders.length === 0) {
      // No orders, default to pending
      return 'pending_updates';
    }

    // Check if any order has status 'pending_updates'
    const hasPendingOrders = customerOrders.some(order => order.status === 'pending_updates');

    if (hasPendingOrders) {
      return 'pending_updates';
    }

    // Check if all orders are completed
    const allOrdersCompleted = customerOrders.every(order => order.status === 'completed');

    if (!allOrdersCompleted) {
      return 'pending_updates';
    }

    // All orders are completed, now check invoices
    // Get all invoices for all orders of this customer
    const orderIds = customerOrders.map(order => order.id);

    if (orderIds.length === 0) {
      // No orders, but we already checked that above
      return 'pending_updates';
    }

    // Get all invoices for these orders
    const allInvoices = await db.query.invoices.findMany({
      where: inArray(invoices.orderId, orderIds),
    });

    // Check if any invoice has open_balance > 0
    // open_balance = invoice_amount - payments_received
    const hasUnpaidInvoices = allInvoices.some(invoice => {
      const amount = parseFloat(invoice.invoiceAmount?.toString() || '0');
      const payments = parseFloat(invoice.paymentsReceived?.toString() || '0');
      const openBalance = amount - payments;
      return openBalance > 0;
    });

    if (hasUnpaidInvoices) {
      return 'pending_updates';
    }

    // All orders are completed and all invoices are paid
    return 'completed';
  } catch (error) {
    console.error('Error calculating customer status:', error);
    // On error, default to pending_updates
    return 'pending_updates';
  }
}

/**
 * Update customer status in database
 */
export async function updateCustomerStatus(dbxCustomerId: string): Promise<void> {
  try {
    const newStatus = await calculateCustomerStatus(dbxCustomerId);

    await db.update(customers)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(customers.dbxCustomerId, dbxCustomerId));
  } catch (error) {
    console.error('Error updating customer status:', error);
    throw error;
  }
}

/**
 * Recalculate and update customer status for a given order
 * (Helper function to be called after order/invoice changes)
 */
export async function recalculateCustomerStatusForOrder(orderId: string): Promise<void> {
  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    if (!order) {
      console.warn(`Order ${orderId} not found for status recalculation`);
      return;
    }

    await updateCustomerStatus(order.customerId);
  } catch (error) {
    console.error('Error recalculating customer status for order:', error);
    throw error;
  }
}

