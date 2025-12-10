import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { desc, and, gte, eq, count, or, ilike, inArray } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all'; // day, week, month, all
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;
    
    // Additional filters
    const changeType = searchParams.get('changeType');
    const userId = searchParams.get('userId');
    const customerId = searchParams.get('customerId');
    const search = searchParams.get('search');

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

    // Valid change types from the enum
    type ChangeType = 'cell_edit' | 'row_add' | 'row_delete' | 'row_update' | 'customer_edit' | 'order_edit' | 'contract_add' | 'stage_update' | 'customer_delete' | 'customer_restore';
    const validChangeTypes: ChangeType[] = [
      'cell_edit',
      'row_add',
      'row_delete',
      'row_update',
      'customer_edit',
      'order_edit',
      'contract_add',
      'stage_update',
      'customer_delete',
      'customer_restore',
    ];

    // Type guard function to validate changeType
    const isValidChangeType = (value: string | null): value is ChangeType => {
      return value !== null && validChangeTypes.includes(value as ChangeType);
    };

    // Build where clause
    const whereConditions = [];
    if (dateFilter) {
      whereConditions.push(gte(schema.changeHistory.changedAt, dateFilter));
    }
    if (isValidChangeType(changeType)) {
      whereConditions.push(eq(schema.changeHistory.changeType, changeType));
    }
    if (userId) {
      whereConditions.push(eq(schema.changeHistory.changedBy, userId));
    }
    if (customerId) {
      // Trim and use case-insensitive partial matching for customer ID
      const trimmedCustomerId = customerId.trim();
      whereConditions.push(ilike(schema.changeHistory.customerId, `%${trimmedCustomerId}%`));
    }
    if (search) {
      // Search in fieldName (case-insensitive)
      whereConditions.push(ilike(schema.changeHistory.fieldName, `%${search}%`));
    }

    // Fetch changes with pagination
    const allChanges = await db
      .select()
      .from(schema.changeHistory)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(schema.changeHistory.changedAt))
      .limit(limit)
      .offset(offset);

    console.log(`[Timeline] Fetched ${allChanges.length} changes`);

    // Get total count
    const totalCountResult = await db
      .select({ count: count(schema.changeHistory.id) })
      .from(schema.changeHistory)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);
    const totalCount = Number(totalCountResult[0]?.count || 0);

    console.log(`[Timeline] Total count: ${totalCount}`);

    // Batch fetch all related data to avoid N+1 queries
    const userIds = [...new Set(allChanges.map(c => c.changedBy).filter(Boolean) as string[])];
    const customerIds = [...new Set(allChanges.map(c => c.customerId).filter(Boolean) as string[])];
    const orderIds = [...new Set(allChanges.map(c => c.orderId).filter(Boolean) as string[])];

    // Batch fetch users
    const users = userIds.length > 0
      ? await db
          .select()
          .from(schema.users)
          .where(inArray(schema.users.id, userIds))
      : [];
    const usersMap = new Map(users.map(u => [u.id, u]));

    // Batch fetch customers
    const customers = customerIds.length > 0
      ? await db
          .select()
          .from(schema.customers)
          .where(inArray(schema.customers.dbxCustomerId, customerIds))
      : [];
    const customersMap = new Map(customers.map(c => [c.dbxCustomerId, c]));

    // Batch fetch orders
    const orders = orderIds.length > 0
      ? await db
          .select()
          .from(schema.orders)
          .where(inArray(schema.orders.id, orderIds))
      : [];
    const ordersMap = new Map(orders.map(o => [o.id, o]));

    // Format changes using batched data
    const formattedChanges = allChanges.map((change) => {
      const user = change.changedBy ? usersMap.get(change.changedBy) || null : null;
      const customer = change.customerId ? customersMap.get(change.customerId) || null : null;
      const order = change.orderId ? ordersMap.get(change.orderId) || null : null;

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
    });

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
    console.error('Error fetching timeline:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      {
        error: 'Failed to fetch timeline',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

