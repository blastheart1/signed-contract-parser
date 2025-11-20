import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { sql, and, or, isNull, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Calculate Total Earned (sum of completedAmount from order items)
    const earnedResult = await db
      .select({ total: sql<number>`COALESCE(SUM(${schema.orderItems.completedAmount}::numeric), 0)` })
      .from(schema.orderItems);

    const totalEarned = parseFloat(earnedResult[0]?.total?.toString() || '0');

    // Calculate Total Invoiced (sum of invoiceAmount from invoices, excluding excluded invoices)
    const invoicedResult = await db
      .select({ total: sql<number>`COALESCE(SUM(${schema.invoices.invoiceAmount}::numeric), 0)` })
      .from(schema.invoices)
      .where(or(isNull(schema.invoices.exclude), eq(schema.invoices.exclude, false)));

    const totalInvoiced = parseFloat(invoicedResult[0]?.total?.toString() || '0');

    // Calculate Total Collected (sum of paymentsReceived from invoices, excluding excluded invoices)
    const collectedResult = await db
      .select({ total: sql<number>`COALESCE(SUM(${schema.invoices.paymentsReceived}::numeric), 0)` })
      .from(schema.invoices)
      .where(or(isNull(schema.invoices.exclude), eq(schema.invoices.exclude, false)));

    const totalCollected = parseFloat(collectedResult[0]?.total?.toString() || '0');

    // Calculate Revenue Gap
    const revenueGap = totalEarned - totalInvoiced - totalCollected;

    // Calculate Collection Efficiency (Collected / Invoiced * 100)
    const collectionEfficiency =
      totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;

    // Calculate Billing Efficiency (Invoiced / Earned * 100)
    const billingEfficiency = totalEarned > 0 ? (totalInvoiced / totalEarned) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        totalEarned: parseFloat(totalEarned.toFixed(2)),
        totalInvoiced: parseFloat(totalInvoiced.toFixed(2)),
        totalCollected: parseFloat(totalCollected.toFixed(2)),
        revenueGap: parseFloat(revenueGap.toFixed(2)),
        collectionEfficiency: parseFloat(collectionEfficiency.toFixed(2)),
        billingEfficiency: parseFloat(billingEfficiency.toFixed(2)),
      },
    });
  } catch (error) {
    console.error('Error fetching revenue recognition:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch revenue recognition',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

