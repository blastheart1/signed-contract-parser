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

    // Build where clause
    const whereConditions = [];
    if (dateFilter) {
      whereConditions.push(gte(schema.changeHistory.changedAt, dateFilter));
    }
    if (changeType) {
      whereConditions.push(eq(schema.changeHistory.changeType, changeType as any));
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

    // Get total count
    const totalCountResult = await db
      .select({ count: count(schema.changeHistory.id) })
      .from(schema.changeHistory)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);
    const totalCount = Number(totalCountResult[0]?.count || 0);

    // Extract unique IDs for batch fetching
    const userIds = [...new Set(allChanges.map(c => c.changedBy).filter((id): id is string => !!id))];
    const customerIds = [...new Set(allChanges.map(c => c.customerId).filter((id): id is string => !!id))];
    const orderIds = [...new Set(allChanges.map(c => c.orderId).filter((id): id is string => !!id))];

    // Batch fetch all related data in parallel
    const [allUsers, allCustomers, allOrders] = await Promise.all([
      // Fetch users
      userIds.length > 0
        ? db
            .select()
            .from(schema.users)
            .where(inArray(schema.users.id, userIds))
        : [],
      // Fetch customers
      customerIds.length > 0
        ? db
            .select()
            .from(schema.customers)
            .where(inArray(schema.customers.dbxCustomerId, customerIds))
        : [],
      // Fetch orders
      orderIds.length > 0
        ? db
            .select()
            .from(schema.orders)
            .where(inArray(schema.orders.id, orderIds))
        : [],
    ]);

    // Create lookup maps for O(1) access
    const usersMap = new Map<string, typeof schema.users.$inferSelect>();
    for (const user of allUsers) {
      usersMap.set(user.id, user);
    }

    const customersMap = new Map<string, typeof schema.customers.$inferSelect>();
    for (const customer of allCustomers) {
      customersMap.set(customer.dbxCustomerId, customer);
    }

    const ordersMap = new Map<string, typeof schema.orders.$inferSelect>();
    for (const order of allOrders) {
      ordersMap.set(order.id, order);
    }

    // Format changes using lookup maps
    const formattedChanges = allChanges.map((change) => {
      // Get user from map
      const user = change.changedBy ? usersMap.get(change.changedBy) : null;

      // Get customer from map
      const customer = change.customerId ? customersMap.get(change.customerId) : null;

      // Get order from map
      const order = change.orderId ? ordersMap.get(change.orderId) : null;

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
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
      }
    });
  } catch (error) {
    console.error('Error fetching timeline:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch timeline',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

