import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { sql, and, isNull, eq, gte } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all'; // month, all

    // Calculate date filter for "this month" comparison
    const now = new Date();
    let dateFilter: Date | null = null;
    if (period === 'month') {
      dateFilter = new Date(now.getFullYear(), now.getMonth(), 1);
    }

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

    // Filter by period if specified
    const filteredOrders = dateFilter
      ? orders.filter((order) => {
          const orderDate = order.orderDate || order.createdAt;
          return orderDate && new Date(orderDate) >= dateFilter;
        })
      : orders;

    // Group by sales rep
    const repStats = new Map<
      string,
      {
        repName: string;
        totalSales: number;
        orderCount: number;
        completedCount: number;
        pendingCount: number;
        averageOrderValue: number;
      }
    >();

    for (const order of filteredOrders) {
      const repName = order.salesRep || 'Unassigned';
      const orderValue = parseFloat(order.orderGrandTotal?.toString() || '0');
      const isCompleted = order.status === 'completed';

      if (!repStats.has(repName)) {
        repStats.set(repName, {
          repName,
          totalSales: 0,
          orderCount: 0,
          completedCount: 0,
          pendingCount: 0,
          averageOrderValue: 0,
        });
      }

      const stats = repStats.get(repName)!;
      stats.totalSales += orderValue;
      stats.orderCount += 1;
      if (isCompleted) {
        stats.completedCount += 1;
      } else {
        stats.pendingCount += 1;
      }
    }

    // Calculate averages and completion rates
    const repPerformance = Array.from(repStats.values()).map((stats) => ({
      ...stats,
      averageOrderValue: stats.orderCount > 0 ? stats.totalSales / stats.orderCount : 0,
      completionRate: stats.orderCount > 0 ? (stats.completedCount / stats.orderCount) * 100 : 0,
    }));

    // Sort by total sales (descending)
    repPerformance.sort((a, b) => b.totalSales - a.totalSales);

    // Calculate totals
    const totals = {
      totalSales: repPerformance.reduce((sum, rep) => sum + rep.totalSales, 0),
      totalOrders: repPerformance.reduce((sum, rep) => sum + rep.orderCount, 0),
      totalCompleted: repPerformance.reduce((sum, rep) => sum + rep.completedCount, 0),
      totalPending: repPerformance.reduce((sum, rep) => sum + rep.pendingCount, 0),
    };

    // Calculate this month vs last month if period is 'month'
    let monthComparison = null;
    if (period === 'month') {
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthOrders = orders.filter((order) => {
        const orderDate = order.orderDate || order.createdAt;
        return (
          orderDate &&
          new Date(orderDate) >= lastMonthStart &&
          new Date(orderDate) < dateFilter!
        );
      });

      const lastMonthSales = lastMonthOrders.reduce(
        (sum, order) => sum + parseFloat(order.orderGrandTotal?.toString() || '0'),
        0
      );

      monthComparison = {
        thisMonth: totals.totalSales,
        lastMonth: lastMonthSales,
        change: totals.totalSales - lastMonthSales,
        changePercent:
          lastMonthSales > 0
            ? ((totals.totalSales - lastMonthSales) / lastMonthSales) * 100
            : 0,
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        repPerformance,
        totals,
        monthComparison,
        period,
      },
    });
  } catch (error) {
    console.error('Error fetching sales performance:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch sales performance',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

