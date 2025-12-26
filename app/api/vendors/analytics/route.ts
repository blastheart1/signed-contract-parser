import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, isNotNull, sql, and, isNull } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get('vendorId');
    const view = searchParams.get('view') || 'category'; // 'category' or 'vendor'
    const category = searchParams.get('category');

    // Build where clause for order_items
    let whereConditions: any[] = [];

    // Only include items with vendor_name_1 (not null)
    whereConditions.push(isNotNull(schema.orderItems.vendorName1));

    // Filter by specific vendor if provided
    if (vendorId) {
      // First get vendor name
      const [vendor] = await db
        .select()
        .from(schema.vendors)
        .where(eq(schema.vendors.id, vendorId))
        .limit(1);

      if (vendor) {
        whereConditions.push(eq(schema.orderItems.vendorName1, vendor.name));
      }
    }

    // Filter by category if provided
    if (category) {
      whereConditions.push(eq(schema.orderItems.subCategory, category));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Query order_items - join with orders and customers to filter out deleted customers
    // Calculate profitability metrics
    const analyticsData = await db
      .select({
        subCategory: schema.orderItems.subCategory,
        vendorName: schema.orderItems.vendorName1,
        totalWorkAssigned: sql<number>`COALESCE(SUM(CAST(${schema.orderItems.totalWorkAssignedToVendor} AS NUMERIC)), 0)`,
        totalEstimatedCost: sql<number>`COALESCE(SUM(CAST(${schema.orderItems.estimatedVendorCost} AS NUMERIC)), 0)`,
        totalActualCost: sql<number>`COALESCE(SUM(CAST(${schema.orderItems.vendorBillingToDate} AS NUMERIC)), 0)`,
        totalSavingsDeficit: sql<number>`COALESCE(SUM(CAST(${schema.orderItems.vendorSavingsDeficit} AS NUMERIC)), 0)`,
        itemCount: sql<number>`COUNT(*)`,
        projectCount: sql<number>`COUNT(DISTINCT ${schema.orderItems.orderId})`,
      })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
      .innerJoin(schema.customers, eq(schema.orders.customerId, schema.customers.dbxCustomerId))
      .where(
        and(
          whereClause,
          isNull(schema.customers.deletedAt)
        )
      )
      .groupBy(schema.orderItems.subCategory, schema.orderItems.vendorName1);

    // Process data to calculate profitability and cost variance
    const processedData = analyticsData.map(item => {
      const totalWorkAssigned = Number(item.totalWorkAssigned) || 0;
      const totalEstimatedCost = Number(item.totalEstimatedCost) || 0;
      const totalActualCost = Number(item.totalActualCost) || 0;
      const totalSavingsDeficit = Number(item.totalSavingsDeficit) || 0;

      // Profitability = total_work_assigned_to_vendor - vendor_billing_to_date
      const profitability = totalWorkAssigned - totalActualCost;

      // Profit margin = (profitability / total_work_assigned_to_vendor) * 100
      const profitMargin = totalWorkAssigned > 0 ? (profitability / totalWorkAssigned) * 100 : 0;

      // Cost variance = estimated_cost - actual_cost
      const costVariance = totalEstimatedCost - totalActualCost;

      // Cost variance percentage = (variance / estimated_cost) * 100
      const costVariancePercentage = totalEstimatedCost > 0 
        ? (costVariance / totalEstimatedCost) * 100 
        : 0;

      // Variance status: Green: -5% to +5%, Yellow: ±5% to ±10%, Red: >±10%
      const absVariance = Math.abs(costVariancePercentage);
      let varianceStatus: 'acceptable' | 'monitor' | 'action_required' = 'acceptable';
      if (absVariance > 10) {
        varianceStatus = 'action_required';
      } else if (absVariance > 5) {
        varianceStatus = 'monitor';
      }

      return {
        subCategory: item.subCategory || 'Uncategorized',
        vendorName: item.vendorName || 'Unassigned',
        totalWorkAssigned,
        totalEstimatedCost,
        totalActualCost,
        totalSavingsDeficit,
        profitability,
        profitMargin: Math.round(profitMargin * 100) / 100, // Round to 2 decimal places
        costVariance,
        costVariancePercentage: Math.round(costVariancePercentage * 100) / 100,
        varianceStatus,
        itemCount: Number(item.itemCount) || 0,
        projectCount: Number(item.projectCount) || 0,
      };
    });

    // Group by category for summary
    const categorySummary = processedData.reduce((acc, item) => {
      const category = item.subCategory;
      if (!acc[category]) {
        acc[category] = {
          category,
          totalWorkAssigned: 0,
          totalEstimatedCost: 0,
          totalActualCost: 0,
          totalProfitability: 0,
          totalCostVariance: 0,
          itemCount: 0,
          projectCount: 0,
          vendorCount: new Set<string>(),
        };
      }
      acc[category].totalWorkAssigned += item.totalWorkAssigned;
      acc[category].totalEstimatedCost += item.totalEstimatedCost;
      acc[category].totalActualCost += item.totalActualCost;
      acc[category].totalProfitability += item.profitability;
      acc[category].totalCostVariance += item.costVariance;
      acc[category].itemCount += item.itemCount;
      acc[category].projectCount = Math.max(acc[category].projectCount, item.projectCount);
      acc[category].vendorCount.add(item.vendorName);
      return acc;
    }, {} as Record<string, any>);

    // Calculate average profit margin and cost variance for each category
    const categorySummaryArray = Object.values(categorySummary).map((cat: any) => {
      const avgProfitMargin = cat.totalWorkAssigned > 0
        ? (cat.totalProfitability / cat.totalWorkAssigned) * 100
        : 0;
      const avgCostVariancePercentage = cat.totalEstimatedCost > 0
        ? (cat.totalCostVariance / cat.totalEstimatedCost) * 100
        : 0;
      const absVariance = Math.abs(avgCostVariancePercentage);
      let varianceStatus: 'acceptable' | 'monitor' | 'action_required' = 'acceptable';
      if (absVariance > 10) {
        varianceStatus = 'action_required';
      } else if (absVariance > 5) {
        varianceStatus = 'monitor';
      }
      return {
        ...cat,
        vendorCount: cat.vendorCount.size,
        averageProfitMargin: Math.round(avgProfitMargin * 100) / 100,
        averageCostVariancePercentage: Math.round(avgCostVariancePercentage * 100) / 100,
        varianceStatus,
      };
    });

    // Group by vendor for vendor view
    const vendorSummary = processedData.reduce((acc, item) => {
      const vendor = item.vendorName;
      if (!acc[vendor]) {
        acc[vendor] = {
          vendorName: vendor,
          totalWorkAssigned: 0,
          totalEstimatedCost: 0,
          totalActualCost: 0,
          totalProfitability: 0,
          totalCostVariance: 0,
          itemCount: 0,
          projectCount: 0,
          categoryCount: new Set<string>(),
        };
      }
      acc[vendor].totalWorkAssigned += item.totalWorkAssigned;
      acc[vendor].totalEstimatedCost += item.totalEstimatedCost;
      acc[vendor].totalActualCost += item.totalActualCost;
      acc[vendor].totalProfitability += item.profitability;
      acc[vendor].totalCostVariance += item.costVariance;
      acc[vendor].itemCount += item.itemCount;
      acc[vendor].projectCount = Math.max(acc[vendor].projectCount, item.projectCount);
      acc[vendor].categoryCount.add(item.subCategory);
      return acc;
    }, {} as Record<string, any>);

    // Calculate metrics for each vendor
    const vendorSummaryArray = Object.values(vendorSummary).map((vendor: any) => {
      const profitMargin = vendor.totalWorkAssigned > 0
        ? (vendor.totalProfitability / vendor.totalWorkAssigned) * 100
        : 0;
      const costVariancePercentage = vendor.totalEstimatedCost > 0
        ? (vendor.totalCostVariance / vendor.totalEstimatedCost) * 100
        : 0;
      const absVariance = Math.abs(costVariancePercentage);
      let varianceStatus: 'acceptable' | 'monitor' | 'action_required' = 'acceptable';
      if (absVariance > 10) {
        varianceStatus = 'action_required';
      } else if (absVariance > 5) {
        varianceStatus = 'monitor';
      }
      return {
        ...vendor,
        categoryCount: vendor.categoryCount.size,
        profitMargin: Math.round(profitMargin * 100) / 100,
        costVariancePercentage: Math.round(costVariancePercentage * 100) / 100,
        varianceStatus,
      };
    });

    // Overall summary
    const overallSummary = {
      totalWorkAssigned: processedData.reduce((sum, item) => sum + item.totalWorkAssigned, 0),
      totalEstimatedCost: processedData.reduce((sum, item) => sum + item.totalEstimatedCost, 0),
      totalActualCost: processedData.reduce((sum, item) => sum + item.totalActualCost, 0),
      totalProfitability: processedData.reduce((sum, item) => sum + item.profitability, 0),
      totalItems: processedData.reduce((sum, item) => sum + item.itemCount, 0),
      totalProjects: Math.max(...processedData.map(item => item.projectCount), 0),
      totalVendors: new Set(processedData.map(item => item.vendorName)).size,
      totalCategories: categorySummaryArray.length,
    };

    const overallProfitMargin = overallSummary.totalWorkAssigned > 0
      ? (overallSummary.totalProfitability / overallSummary.totalWorkAssigned) * 100
      : 0;

    const overallCostVariance = overallSummary.totalEstimatedCost - overallSummary.totalActualCost;
    const overallCostVariancePercentage = overallSummary.totalEstimatedCost > 0
      ? (overallCostVariance / overallSummary.totalEstimatedCost) * 100
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        overall: {
          ...overallSummary,
          averageProfitMargin: Math.round(overallProfitMargin * 100) / 100,
          totalCostVariance: overallCostVariance,
          averageCostVariancePercentage: Math.round(overallCostVariancePercentage * 100) / 100,
        },
        byCategory: categorySummaryArray,
        byVendor: vendorSummaryArray,
        byVendorAndCategory: processedData,
        view,
      },
    });
  } catch (error) {
    console.error('[Vendors Analytics] Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendor analytics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

