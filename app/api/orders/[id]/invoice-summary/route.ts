import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderItems, invoices } from '@/lib/db/schema';
import { eq, and, or, isNull } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;

    // Get order
    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    const order = orderRows[0];

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found', id: orderId },
        { status: 404 }
      );
    }

    // Original Invoice (N345: =H342)
    // Use order.orderGrandTotal from the order table as the primary source
    // This matches the Excel template where H342 represents the total order amount
    const originalInvoice = parseFloat(order.orderGrandTotal?.toString() || '0');
    console.log(`[Invoice Summary] Original Invoice: ${originalInvoice}`);

    // Total Completed - Calculate from progressOverallPct * amount for each item
    // This ensures real-time calculation based on current table values
    // Formula: completedAmount = (progressOverallPct / 100) * amount
    const allOrderItems = await db
      .select({
        amount: orderItems.amount,
        progressOverallPct: orderItems.progressOverallPct,
        itemType: orderItems.itemType,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Calculate total completed amount from progressOverallPct * amount for each item
    let totalCompleted = 0;
    for (const item of allOrderItems) {
      // Only calculate for actual line items (not categories)
      if (item.itemType === 'item') {
        const amount = parseFloat(item.amount?.toString() || '0');
        const progressPct = parseFloat(item.progressOverallPct?.toString() || '0');
        
        if (amount > 0 && progressPct > 0) {
          // Calculate: (progressPct / 100) * amount
          const itemCompletedAmount = (progressPct / 100) * amount;
          totalCompleted += itemCompletedAmount;
        } else if (item.amount && parseFloat(item.amount.toString()) > 0) {
          // Fallback: if progressPct is 0 or null, use 0 for completed amount
          // This matches the calculation logic in the save endpoint
        }
      }
    }
    
    console.log(`[Invoice Summary] Total Completed (calculated from progressOverallPct * amount): ${totalCompleted}`);

    // Balance Remaining (N346: =H342-J342)
    // Original Invoice minus Total Completed (from order items)
    const balanceRemaining = originalInvoice - totalCompleted;

    // Total Invoice Amounts - Sum of invoiceAmount from invoices table
    // Only include invoices that are not excluded (exclude = false or null)
    // This is used for "Less Payments Received" field
    const invoiceAmountsResult = await db
      .select({ total: sql<number>`COALESCE(SUM(${invoices.invoiceAmount}::numeric), 0)` })
      .from(invoices)
      .where(
        and(
          eq(invoices.orderId, orderId),
          or(isNull(invoices.exclude), eq(invoices.exclude, false))
        )
      );

    const totalInvoiceAmounts = parseFloat(invoiceAmountsResult[0]?.total?.toString() || '0');
    console.log(`[Invoice Summary] Total Invoice Amounts: ${totalInvoiceAmounts}`);

    // Less Payments Received (N348: =-G392)
    // Calculate G392: SUM(G354:G391) - Total payments received from all invoices
    // This is the sum of the 'paymentsReceived' column (Column G) from all invoices
    // Note: Only include invoices that are not excluded (exclude = false or null)
    const paymentsResult = await db
      .select({ total: sql<number>`COALESCE(SUM(${invoices.paymentsReceived}::numeric), 0)` })
      .from(invoices)
      .where(
        and(
          eq(invoices.orderId, orderId),
          or(isNull(invoices.exclude), eq(invoices.exclude, false))
        )
      );

    const totalPayments = parseFloat(paymentsResult[0]?.total?.toString() || '0');
    console.log(`[Invoice Summary] Total Payments Received: ${totalPayments}`);
    
    // Negative value as per Excel formula convention
    const lessPaymentsReceived = -totalPayments;

    // Total Due Upon Receipt (N349: =N347+N348)
    // Total Completed (from order items) minus Total Payments Received
    const totalDueUponReceipt = totalCompleted + lessPaymentsReceived;

    // Calculate percentage completed: (Total Completed from order items / Original Invoice) * 100
    const percentCompleted = originalInvoice > 0 
      ? (totalCompleted / originalInvoice) * 100 
      : 0;
    
    console.log(`[Invoice Summary] Percent Completed: ${percentCompleted.toFixed(2)}%`);
    console.log(`[Invoice Summary] Balance Remaining: ${balanceRemaining}`);
    console.log(`[Invoice Summary] Less Payments Received: ${lessPaymentsReceived}`);
    console.log(`[Invoice Summary] Total Due Upon Receipt: ${totalDueUponReceipt}`);

    // Calculate summary values (combining order items and invoices)
    const summary = {
      originalInvoice, // N345: =H342 (from order.orderGrandTotal)
      balanceRemaining, // Original Invoice - Total Completed (from order items)
      totalCompleted, // Total completed amount from order items table
      percentCompleted, // Calculated percentage: (totalCompleted / originalInvoice) * 100
      lessPaymentsReceived, // Total payments received from invoices (negative value)
      totalDueUponReceipt, // Total Completed (order items) + Less Payments Received
    };

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error('Error calculating invoice summary:', error);
    return NextResponse.json(
      {
        error: 'Failed to calculate invoice summary',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

