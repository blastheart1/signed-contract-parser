import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { sql, and, isNull, eq, lt, gte } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const next7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const next30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get all orders
    const allOrders = await db
      .select()
      .from(schema.orders);

    // Fetch customers and items for all orders and filter out deleted
    const orders: Array<typeof allOrders[0] & { 
      customer: typeof schema.customers.$inferSelect | null;
      items: Array<typeof schema.orderItems.$inferSelect>;
    }> = [];
    
    for (const order of allOrders) {
      const [customer] = await db
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.dbxCustomerId, order.customerId))
        .limit(1);
      
      // Only include orders from non-deleted customers
      if (customer && !customer.deletedAt) {
        const items = await db
          .select()
          .from(schema.orderItems)
          .where(eq(schema.orderItems.orderId, order.id));
        
        orders.push({ ...order, customer, items });
      }
    }

    const overdueProjects: Array<{
      orderId: string;
      orderNo: string;
      customerId: string;
      clientName: string;
      orderDueDate: Date | null;
      daysOverdue: number;
      status: string;
    }> = [];

    const dueSoon7Days: typeof overdueProjects = [];
    const dueSoon30Days: typeof overdueProjects = [];
    const lowProgressProjects: Array<{
      orderId: string;
      orderNo: string;
      customerId: string;
      clientName: string;
      orderDate: Date | null;
      daysSinceStart: number;
      averageProgress: number;
    }> = [];

    let totalCompletionTime = 0;
    let completedCount = 0;

    for (const order of orders) {
      const orderDate = order.orderDate || order.createdAt;
      const dueDate = order.orderDueDate;
      const status = order.status || 'pending_updates';

      // Check for overdue projects
      if (dueDate && new Date(dueDate) < today && status === 'pending_updates') {
        const daysOverdue = Math.floor(
          (today.getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        overdueProjects.push({
          orderId: order.id,
          orderNo: order.orderNo,
          customerId: order.customerId,
          clientName: order.customer?.clientName || 'Unknown',
          orderDueDate: dueDate,
          daysOverdue,
          status,
        });
      }

      // Check for projects due soon (7 days)
      if (dueDate && new Date(dueDate) >= today && new Date(dueDate) <= next7Days) {
        dueSoon7Days.push({
          orderId: order.id,
          orderNo: order.orderNo,
          customerId: order.customerId,
          clientName: order.customer?.clientName || 'Unknown',
          orderDueDate: dueDate,
          daysOverdue: 0,
          status,
        });
      }

      // Check for projects due soon (30 days)
      if (
        dueDate &&
        new Date(dueDate) > next7Days &&
        new Date(dueDate) <= next30Days
      ) {
        dueSoon30Days.push({
          orderId: order.id,
          orderNo: order.orderNo,
          customerId: order.customerId,
          clientName: order.customer?.clientName || 'Unknown',
          orderDueDate: dueDate,
          daysOverdue: 0,
          status,
        });
      }

      // Check for low progress projects
      if (orderDate && new Date(orderDate) <= thirtyDaysAgo && status === 'pending_updates') {
        const daysSinceStart = Math.floor(
          (today.getTime() - new Date(orderDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Calculate average progress from order items
        const items = order.items || [];
        if (items.length > 0) {
          const totalProgress = items.reduce((sum, item) => {
            return sum + parseFloat(item.progressOverallPct?.toString() || '0');
          }, 0);
          const averageProgress = totalProgress / items.length;

          if (averageProgress < 25) {
            lowProgressProjects.push({
              orderId: order.id,
              orderNo: order.orderNo,
              customerId: order.customerId,
              clientName: order.customer?.clientName || 'Unknown',
              orderDate,
              daysSinceStart,
              averageProgress: parseFloat(averageProgress.toFixed(2)),
            });
          }
        }
      }

      // Calculate average completion time for completed orders
      if (status === 'completed' && orderDate && order.updatedAt) {
        const completionTime = Math.floor(
          (new Date(order.updatedAt).getTime() - new Date(orderDate).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        totalCompletionTime += completionTime;
        completedCount += 1;
      }
    }

    // Sort overdue projects by days overdue (most overdue first)
    overdueProjects.sort((a, b) => b.daysOverdue - a.daysOverdue);

    const averageCompletionTime =
      completedCount > 0 ? Math.floor(totalCompletionTime / completedCount) : 0;

    return NextResponse.json({
      success: true,
      data: {
        overdueCount: overdueProjects.length,
        overdueProjects: overdueProjects.slice(0, 10), // Top 10 most overdue
        dueSoon7DaysCount: dueSoon7Days.length,
        dueSoon7Days: dueSoon7Days.slice(0, 10),
        dueSoon30DaysCount: dueSoon30Days.length,
        dueSoon30Days: dueSoon30Days.slice(0, 10),
        lowProgressCount: lowProgressProjects.length,
        lowProgressProjects: lowProgressProjects.slice(0, 10),
        averageCompletionTime,
      },
    });
  } catch (error) {
    console.error('Error fetching project health:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch project health',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

