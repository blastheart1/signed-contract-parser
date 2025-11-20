import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { sql, and, or, isNull, eq, gte, lt } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Get all orders
    const allOrders = await db
      .select()
      .from(schema.orders);

    // Fetch customers for all orders and filter out deleted
    const orders: Array<typeof allOrders[0] & { customer: typeof schema.customers.$inferSelect | null }> = [];
    
    for (const order of allOrders) {
      const [customer] = await db
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.dbxCustomerId, order.customerId))
        .limit(1);
      
      // Only include orders from non-deleted customers
      if (customer && !customer.deletedAt) {
        orders.push({ ...order, customer });
      }
    }

    // Get all invoices (excluding excluded invoices)
    const allInvoices = await db
      .select()
      .from(schema.invoices)
      .where(or(isNull(schema.invoices.exclude), eq(schema.invoices.exclude, false)));

    // Group invoices by orderId
    const invoicesByOrder = new Map<string, typeof allInvoices>();
    for (const invoice of allInvoices) {
      if (!invoicesByOrder.has(invoice.orderId)) {
        invoicesByOrder.set(invoice.orderId, []);
      }
      invoicesByOrder.get(invoice.orderId)!.push(invoice);
    }

    // Calculate receivables for each order
    const receivables: Array<{
      orderId: string;
      orderNo: string;
      customerId: string;
      clientName: string;
      orderDate: Date | null;
      balanceDue: number;
      totalPayments: number;
      outstanding: number;
      daysOutstanding: number;
      agingBucket: string;
    }> = [];

    const now = new Date();
    for (const order of orders) {
      const orderInvoices = invoicesByOrder.get(order.id) || [];
      const totalPayments = orderInvoices.reduce((sum, inv) => {
        return sum + parseFloat(inv.paymentsReceived?.toString() || '0');
      }, 0);

      const balanceDue = parseFloat(order.balanceDue?.toString() || '0');
      const outstanding = balanceDue - totalPayments;

      if (outstanding <= 0) continue; // Skip fully paid orders

      const orderDate = order.orderDate || order.createdAt;
      const daysOutstanding = orderDate
        ? Math.floor((now.getTime() - new Date(orderDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      let agingBucket = '90+';
      if (daysOutstanding <= 30) {
        agingBucket = '0-30';
      } else if (daysOutstanding <= 60) {
        agingBucket = '31-60';
      } else if (daysOutstanding <= 90) {
        agingBucket = '61-90';
      }

      receivables.push({
        orderId: order.id,
        orderNo: order.orderNo,
        customerId: order.customerId,
        clientName: order.customer?.clientName || 'Unknown',
        orderDate,
        balanceDue,
        totalPayments,
        outstanding,
        daysOutstanding,
        agingBucket,
      });
    }

    // Calculate totals by aging bucket
    const agingBuckets = {
      '0-30': 0,
      '31-60': 0,
      '61-90': 0,
      '90+': 0,
    };

    let totalOutstanding = 0;
    for (const rec of receivables) {
      agingBuckets[rec.agingBucket as keyof typeof agingBuckets] += rec.outstanding;
      totalOutstanding += rec.outstanding;
    }

    // Get top 10 customers by outstanding amount
    const customerTotals = new Map<string, { clientName: string; total: number }>();
    for (const rec of receivables) {
      if (!customerTotals.has(rec.customerId)) {
        customerTotals.set(rec.customerId, {
          clientName: rec.clientName,
          total: 0,
        });
      }
      customerTotals.get(rec.customerId)!.total += rec.outstanding;
    }

    const topCustomers = Array.from(customerTotals.entries())
      .map(([customerId, data]) => ({ customerId, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Calculate collection rate (total payments / total invoiced)
    const totalInvoiced = allInvoices.reduce((sum, inv) => {
      return sum + parseFloat(inv.invoiceAmount?.toString() || '0');
    }, 0);

    const totalCollected = allInvoices.reduce((sum, inv) => {
      return sum + parseFloat(inv.paymentsReceived?.toString() || '0');
    }, 0);

    const collectionRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        totalOutstanding,
        agingBuckets,
        topCustomers,
        collectionRate: parseFloat(collectionRate.toFixed(2)),
        totalInvoiced,
        totalCollected,
        receivablesCount: receivables.length,
      },
    });
  } catch (error) {
    console.error('Error fetching receivables:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch receivables',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

