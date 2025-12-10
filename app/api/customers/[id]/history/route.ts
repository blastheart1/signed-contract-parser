import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { desc, and, gte, eq, count } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all'; // day, week, month, all
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // Calculate date filter based on period
    let dateFilter: Date | null = null;
    const now = new Date();
    if (period === 'day') {
      dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (period === 'week') {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Build where clause
    const whereConditions = [eq(schema.changeHistory.customerId, customerId)];
    if (dateFilter) {
      whereConditions.push(gte(schema.changeHistory.changedAt, dateFilter));
    }

    // Fetch changes with pagination
    const allChanges = await db
      .select()
      .from(schema.changeHistory)
      .where(and(...whereConditions))
      .orderBy(desc(schema.changeHistory.changedAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalCountResult = await db
      .select({ count: count(schema.changeHistory.id) })
      .from(schema.changeHistory)
      .where(and(...whereConditions));
    const totalCount = Number(totalCountResult[0]?.count || 0);

    // Fetch related data for each change
    const formattedChanges = await Promise.all(
      allChanges.map(async (change) => {
        // Fetch user
        const userRows = change.changedBy
          ? await db
              .select()
              .from(schema.users)
              .where(eq(schema.users.id, change.changedBy))
              .limit(1)
          : [];
        const user = userRows[0] || null;

        // Fetch customer
        const customerRows = change.customerId
          ? await db
              .select()
              .from(schema.customers)
              .where(eq(schema.customers.dbxCustomerId, change.customerId))
              .limit(1)
          : [];
        const customer = customerRows[0] || null;

        // Fetch order
        const orderRows = change.orderId
          ? await db
              .select()
              .from(schema.orders)
              .where(eq(schema.orders.id, change.orderId))
              .limit(1)
          : [];
        const order = orderRows[0] || null;

        return {
          id: change.id,
          changeType: change.changeType,
          fieldName: change.fieldName,
          oldValue: change.oldValue,
          newValue: change.newValue,
          rowIndex: change.rowIndex,
          changedAt: change.changedAt,
          changedBy: {
            id: user?.id || null,
            username: user?.username || 'Unknown',
          },
          customer: customer
            ? {
                dbxCustomerId: customer.dbxCustomerId,
                clientName: customer.clientName,
              }
            : null,
          order: order
            ? {
                id: order.id,
                orderNo: order.orderNo,
              }
            : null,
        };
      })
    );

    const hasMore = offset + limit < totalCount;

    return NextResponse.json({
      success: true,
      changes: formattedChanges,
      total: totalCount,
      page,
      limit,
      hasMore,
    });
  } catch (error) {
    console.error('Error fetching customer history:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch customer history',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

