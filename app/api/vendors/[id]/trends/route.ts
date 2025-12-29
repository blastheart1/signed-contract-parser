import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, isNotNull, sql, and, isNull, gte } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const vendorId = params.id;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'monthly'; // monthly or quarterly

    const [vendor] = await db
      .select()
      .from(schema.vendors)
      .where(eq(schema.vendors.id, vendorId))
      .limit(1);

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    // Calculate date range (last 12 months or last 4 quarters)
    const now = new Date();
    let startDate: Date;
    if (period === 'quarterly') {
      // Last 4 quarters
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const currentYear = now.getFullYear();
      startDate = new Date(currentYear, (currentQuarter - 3) * 3, 1);
    } else {
      // Last 12 months
      startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    }

    // Get all order items for this vendor with order and customer info
    const orderItemsData = await db
      .select({
        orderId: schema.orderItems.orderId,
        totalWorkAssigned: schema.orderItems.totalWorkAssignedToVendor,
        estimatedCost: schema.orderItems.estimatedVendorCost,
        actualCost: schema.orderItems.vendorBillingToDate,
        orderDate: schema.orders.orderDate,
        projectStartDate: schema.orders.projectStartDate,
        createdAt: schema.orderItems.createdAt,
      })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
      .innerJoin(schema.customers, eq(schema.orders.customerId, schema.customers.dbxCustomerId))
      .where(
        and(
          eq(schema.orderItems.vendorName1, vendor.name),
          isNotNull(schema.orderItems.vendorName1),
          isNull(schema.customers.deletedAt),
          gte(
            sql`COALESCE(${schema.orders.orderDate}, ${schema.orderItems.createdAt})`,
            startDate
          )
        )
      );

    // Group by period
    const periodMap = new Map<string, {
      period: string;
      profitability: number;
      totalWorkAssigned: number;
      totalEstimatedCost: number;
      totalActualCost: number;
      projectCount: Set<string>;
      itemCount: number;
    }>();

    for (const item of orderItemsData) {
      // Use orderDate if available, otherwise use createdAt
      const itemDate = item.orderDate || item.createdAt;
      if (!itemDate) continue;

      const date = new Date(itemDate);
      let periodKey: string;

      if (period === 'quarterly') {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        periodKey = `${date.getFullYear()}-Q${quarter}`;
      } else {
        // Monthly
        const month = String(date.getMonth() + 1).padStart(2, '0');
        periodKey = `${date.getFullYear()}-${month}`;
      }

      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, {
          period: periodKey,
          profitability: 0,
          totalWorkAssigned: 0,
          totalEstimatedCost: 0,
          totalActualCost: 0,
          projectCount: new Set(),
          itemCount: 0,
        });
      }

      const periodData = periodMap.get(periodKey)!;
      const workAssigned = Number(item.totalWorkAssigned) || 0;
      const estimatedCost = Number(item.estimatedCost) || 0;
      const actualCost = Number(item.actualCost) || 0;

      periodData.totalWorkAssigned += workAssigned;
      periodData.totalEstimatedCost += estimatedCost;
      periodData.totalActualCost += actualCost;
      periodData.projectCount.add(item.orderId);
      periodData.itemCount += 1;
    }

    // Convert to array and calculate derived metrics
    const trendData = Array.from(periodMap.values())
      .map(periodData => {
        const profitability = periodData.totalWorkAssigned - periodData.totalActualCost;
        const profitMargin = periodData.totalWorkAssigned > 0
          ? (profitability / periodData.totalWorkAssigned) * 100
          : 0;
        const costVariance = periodData.totalEstimatedCost - periodData.totalActualCost;
        const costVariancePercentage = periodData.totalEstimatedCost > 0
          ? (costVariance / periodData.totalEstimatedCost) * 100
          : 0;

        return {
          period: periodData.period,
          profitability: Math.round(profitability * 100) / 100,
          totalWorkAssigned: Math.round(periodData.totalWorkAssigned * 100) / 100,
          totalEstimatedCost: Math.round(periodData.totalEstimatedCost * 100) / 100,
          totalActualCost: Math.round(periodData.totalActualCost * 100) / 100,
          projectCount: periodData.projectCount.size,
          itemCount: periodData.itemCount,
          profitMargin: Math.round(profitMargin * 100) / 100,
          costVariance: Math.round(costVariance * 100) / 100,
          costVariancePercentage: Math.round(costVariancePercentage * 100) / 100,
        };
      })
      .sort((a, b) => a.period.localeCompare(b.period));

    return NextResponse.json({
      success: true,
      data: {
        period,
        trends: trendData,
      },
    });
  } catch (error) {
    console.error('[Vendors Trends API] Error fetching trends:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trends', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

