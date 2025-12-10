import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { sql, and, gte, or, isNull, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all'; // day, week, month, all

    // Calculate date filter based on period
    let dateFilter: Date | null = null;
    const now = new Date();
    if (period === 'day') {
      // Today
      dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'week') {
      // Last 7 days
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      // Last 30 days
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Build where clause for invoices
    const whereConditions = [
      or(isNull(schema.invoices.exclude), eq(schema.invoices.exclude, false))
    ];

    if (dateFilter) {
      // Filter by updatedAt to reflect when payment was actually recorded/updated
      whereConditions.push(gte(schema.invoices.updatedAt, dateFilter));
    }

    // Calculate total paid (sum of paymentsReceived from invoices)
    const totalPaidResult = await db
      .select({ total: sql<number>`COALESCE(SUM(${schema.invoices.paymentsReceived}::numeric), 0)` })
      .from(schema.invoices)
      .where(and(...whereConditions));

    const totalPaid = parseFloat(totalPaidResult[0]?.total?.toString() || '0');

    return NextResponse.json({
      success: true,
      totalPaid,
      period,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch dashboard stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

