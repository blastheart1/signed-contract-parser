import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, isNotNull, sql, and, isNull } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { category: string } }
) {
  try {
    // Decode category name from URL
    const categoryName = decodeURIComponent(params.category);

    // Get all order items for this category - get raw data first
    const orderItemsData = await db
      .select({
        vendorName: schema.orderItems.vendorName1,
        totalWorkAssigned: schema.orderItems.totalWorkAssignedToVendor,
        estimatedCost: schema.orderItems.estimatedVendorCost,
        actualCost: schema.orderItems.vendorBillingToDate,
        orderId: schema.orderItems.orderId,
        orderNo: schema.orders.orderNo,
        customerName: schema.customers.clientName,
        customerId: schema.customers.dbxCustomerId,
        projectStartDate: schema.orders.projectStartDate,
        projectEndDate: schema.orders.projectEndDate,
        orderStatus: schema.orders.status,
        stage: schema.orders.stage,
      })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
      .innerJoin(schema.customers, eq(schema.orders.customerId, schema.customers.dbxCustomerId))
      .where(
        and(
          eq(schema.orderItems.subCategory, categoryName),
          isNotNull(schema.orderItems.vendorName1),
          isNull(schema.customers.deletedAt)
        )
      );

    if (orderItemsData.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          category: categoryName,
          metrics: {
            totalWorkAssigned: 0,
            totalEstimatedCost: 0,
            totalActualCost: 0,
            totalProfitability: 0,
            profitMargin: 0,
            costVariance: 0,
            costVariancePercentage: 0,
            itemCount: 0,
            projectCount: 0,
            vendorCount: 0,
            averageProjectValue: 0,
            averageProfitabilityPerProject: 0,
            averageCostPerItem: 0,
            costPerProject: 0,
            costPerDollarWorkAssigned: 0,
            profitableProjectsCount: 0,
            unprofitableProjectsCount: 0,
            profitableProjectsPercentage: 0,
          },
          vendors: [],
          projects: [],
          insights: {
            topPerformer: null,
            mostEfficient: null,
            needsImprovement: null,
            recommendations: [],
          },
          benchmarking: {
            categoryProfitMargin: 0,
            overallAverageProfitMargin: 0,
            categoryCostVariance: 0,
            overallAverageCostVariance: 0,
            categoryVolume: 0,
            overallAverageVolume: 0,
            isAboveAverage: {
              profitMargin: false,
              costVariance: false,
              volume: false,
            },
          },
          trends: {
            volumeTrend: 'stable' as const,
            profitabilityTrend: 'stable' as const,
            costTrend: 'stable' as const,
          },
          distribution: {
            profitableProjectsPercentage: 0,
            unprofitableProjectsPercentage: 0,
            projectStatusDistribution: {
              active: 0,
              completed: 0,
              pending: 0,
            },
          },
        },
      });
    }

    // Process vendor data
    const vendorMap = new Map<string, {
      vendorName: string;
      totalWorkAssigned: number;
      totalEstimatedCost: number;
      totalActualCost: number;
      itemCount: number;
      projectIds: Set<string>;
    }>();

    // Process project data
    const projectMap = new Map<string, {
      orderId: string;
      orderNo: string;
      customerName: string;
      customerId: string;
      totalWorkAssigned: number;
      totalEstimatedCost: number;
      totalActualCost: number;
      projectStartDate: string | null;
      projectEndDate: string | null;
      status: string | null;
      stage: string | null;
    }>();

    for (const item of orderItemsData) {
      const vendorName = item.vendorName || 'Unassigned';
      const workAssigned = Number(item.totalWorkAssigned) || 0;
      const estimatedCost = Number(item.estimatedCost) || 0;
      const actualCost = Number(item.actualCost) || 0;

      // Aggregate vendor data
      if (!vendorMap.has(vendorName)) {
        vendorMap.set(vendorName, {
          vendorName,
          totalWorkAssigned: 0,
          totalEstimatedCost: 0,
          totalActualCost: 0,
          itemCount: 0,
          projectIds: new Set(),
        });
      }
      const vendorData = vendorMap.get(vendorName)!;
      vendorData.totalWorkAssigned += workAssigned;
      vendorData.totalEstimatedCost += estimatedCost;
      vendorData.totalActualCost += actualCost;
      vendorData.itemCount += 1; // Count each item
      vendorData.projectIds.add(item.orderId);

      // Aggregate project data
      if (!projectMap.has(item.orderId)) {
        projectMap.set(item.orderId, {
          orderId: item.orderId,
          orderNo: item.orderNo || '',
          customerName: item.customerName || '',
          customerId: item.customerId || '',
          totalWorkAssigned: 0,
          totalEstimatedCost: 0,
          totalActualCost: 0,
          projectStartDate: item.projectStartDate || null,
          projectEndDate: item.projectEndDate || null,
          status: item.orderStatus || null,
          stage: item.stage || null,
        });
      }
      const projectData = projectMap.get(item.orderId)!;
      projectData.totalWorkAssigned += workAssigned;
      projectData.totalEstimatedCost += estimatedCost;
      projectData.totalActualCost += actualCost;
    }

    // Calculate vendor metrics and performance scores
    const vendors = Array.from(vendorMap.values()).map(vendor => {
      const profitability = vendor.totalWorkAssigned - vendor.totalActualCost;
      const profitMargin = vendor.totalWorkAssigned > 0
        ? (profitability / vendor.totalWorkAssigned) * 100
        : 0;
      const costVariance = vendor.totalEstimatedCost - vendor.totalActualCost;
      const costVariancePercentage = vendor.totalEstimatedCost > 0
        ? (costVariance / vendor.totalEstimatedCost) * 100
        : 0;

      // Variance status
      let varianceStatus: 'acceptable' | 'monitor' | 'action_required' = 'acceptable';
      if (costVariancePercentage < -10) {
        varianceStatus = 'action_required';
      } else if (costVariancePercentage < -5) {
        varianceStatus = 'monitor';
      } else if (costVariancePercentage > 20) {
        varianceStatus = 'monitor';
      }

      // Performance scores (0-100)
      const profitabilityScore = Math.max(0, Math.min(100, (profitMargin / 15) * 100));
      const costEfficiencyScore = Math.max(0, Math.min(100, 100 - Math.abs(costVariancePercentage) * 2));
      const volumeScore = vendor.totalWorkAssigned > 0 ? Math.min(100, (vendor.totalWorkAssigned / 100000) * 100) : 0; // Normalize to 100k
      const reliabilityScore = 80; // Placeholder

      // Composite performance score: 40% profit, 30% cost, 20% volume, 10% reliability
      const performanceScore = (profitabilityScore * 0.4) + (costEfficiencyScore * 0.3) + (volumeScore * 0.2) + (reliabilityScore * 0.1);

      return {
        vendorName: vendor.vendorName,
        totalWorkAssigned: Math.round(vendor.totalWorkAssigned * 100) / 100,
        totalEstimatedCost: Math.round(vendor.totalEstimatedCost * 100) / 100,
        totalActualCost: Math.round(vendor.totalActualCost * 100) / 100,
        totalProfitability: Math.round(profitability * 100) / 100,
        profitMargin: Math.round(profitMargin * 100) / 100,
        costVariance: Math.round(costVariance * 100) / 100,
        costVariancePercentage: Math.round(costVariancePercentage * 100) / 100,
        varianceStatus,
        projectCount: vendor.projectIds.size,
        itemCount: vendor.itemCount,
        performanceScore: Math.round(performanceScore * 100) / 100,
        trend: 'stable' as const, // Placeholder - would need historical data
        isTopPerformer: false, // Will be set after sorting
        isMostEfficient: false,
        needsImprovement: false,
        rank: 0, // Will be set after sorting
      };
    });

    // Sort vendors by performance score and assign ranks
    vendors.sort((a, b) => b.performanceScore - a.performanceScore);
    vendors.forEach((vendor, index) => {
      vendor.rank = index + 1;
      if (index === 0) vendor.isTopPerformer = true;
    });

    // Find most efficient (lowest cost variance percentage, but positive or near zero)
    const mostEfficient = vendors
      .filter(v => v.costVariancePercentage >= -5)
      .sort((a, b) => Math.abs(a.costVariancePercentage) - Math.abs(b.costVariancePercentage))[0];
    if (mostEfficient) mostEfficient.isMostEfficient = true;

    // Find vendors needing improvement (negative profitability or high negative variance)
    vendors.forEach(vendor => {
      if (vendor.totalProfitability < 0 || vendor.costVariancePercentage < -10) {
        vendor.needsImprovement = true;
      }
    });

    // Calculate project metrics
    const projects = Array.from(projectMap.values()).map(project => {
      const profitability = project.totalWorkAssigned - project.totalActualCost;
      const profitMargin = project.totalWorkAssigned > 0
        ? (profitability / project.totalWorkAssigned) * 100
        : 0;
      const costVariance = project.totalEstimatedCost - project.totalActualCost;
      const costVariancePercentage = project.totalEstimatedCost > 0
        ? (costVariance / project.totalEstimatedCost) * 100
        : 0;

      return {
        orderId: project.orderId,
        orderNo: project.orderNo,
        customerName: project.customerName,
        customerId: project.customerId,
        totalWorkAssigned: Math.round(project.totalWorkAssigned * 100) / 100,
        profitability: Math.round(profitability * 100) / 100,
        profitMargin: Math.round(profitMargin * 100) / 100,
        costVariance: Math.round(costVariance * 100) / 100,
        costVariancePercentage: Math.round(costVariancePercentage * 100) / 100,
        projectStartDate: project.projectStartDate,
        projectEndDate: project.projectEndDate,
        status: project.status,
        stage: project.stage,
        isProfitable: profitability >= 0,
      };
    });

    // Calculate overall category metrics
    const totalWorkAssigned = vendors.reduce((sum, v) => sum + v.totalWorkAssigned, 0);
    const totalEstimatedCost = vendors.reduce((sum, v) => sum + v.totalEstimatedCost, 0);
    const totalActualCost = vendors.reduce((sum, v) => sum + v.totalActualCost, 0);
    const totalProfitability = totalWorkAssigned - totalActualCost;
    const profitMargin = totalWorkAssigned > 0 ? (totalProfitability / totalWorkAssigned) * 100 : 0;
    const costVariance = totalEstimatedCost - totalActualCost;
    const costVariancePercentage = totalEstimatedCost > 0 ? (costVariance / totalEstimatedCost) * 100 : 0;
    const totalItems = vendors.reduce((sum, v) => sum + v.itemCount, 0);
    const uniqueProjects = new Set(projects.map(p => p.orderId)).size;
    const profitableProjects = projects.filter(p => p.isProfitable).length;

    // Generate insights
    const topPerformer = vendors.find(v => v.isTopPerformer);
    const mostEfficientVendor = vendors.find(v => v.isMostEfficient);
    const needsImprovementVendor = vendors.find(v => v.needsImprovement);

    const recommendations: Array<{
      type: 'vendor_selection' | 'cost_optimization' | 'risk_alert' | 'diversification';
      priority: 'high' | 'medium' | 'low';
      message: string;
    }> = [];

    if (topPerformer) {
      recommendations.push({
        type: 'vendor_selection',
        priority: 'high',
        message: `Consider using ${topPerformer.vendorName} for future projects in this category (best profitability: ${topPerformer.profitMargin >= 0 ? '+' : ''}${topPerformer.profitMargin.toFixed(2)}% margin)`,
      });
    }

    if (needsImprovementVendor) {
      recommendations.push({
        type: 'risk_alert',
        priority: 'high',
        message: `${needsImprovementVendor.vendorName} consistently ${needsImprovementVendor.totalProfitability < 0 ? 'losing money' : 'over budget'} - review estimates or consider alternatives`,
      });
    }

    const top3WorkShare = vendors.slice(0, 3).reduce((sum, v) => sum + v.totalWorkAssigned, 0) / totalWorkAssigned * 100;
    if (top3WorkShare > 80) {
      recommendations.push({
        type: 'diversification',
        priority: 'medium',
        message: `Top 3 vendors account for ${top3WorkShare.toFixed(0)}% of work - consider diversification`,
      });
    }

    if (profitMargin < 5) {
      recommendations.push({
        type: 'cost_optimization',
        priority: 'high',
        message: `Category profitability is low (${profitMargin.toFixed(2)}% margin) - investigate cost drivers`,
      });
    }

    // Get overall averages for benchmarking (simplified - would ideally query all categories)
    // For now, we'll use the category's own metrics as placeholder
    const overallAverageProfitMargin = profitMargin; // Placeholder
    const overallAverageCostVariance = costVariancePercentage; // Placeholder
    const overallAverageVolume = totalWorkAssigned; // Placeholder

    // Project status distribution
    const statusCounts = {
      active: projects.filter(p => p.status === 'active' || !p.status).length,
      completed: projects.filter(p => p.status === 'completed').length,
      pending: projects.filter(p => p.status === 'pending_updates' || p.status === 'pending').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        category: categoryName,
        metrics: {
          totalWorkAssigned: Math.round(totalWorkAssigned * 100) / 100,
          totalEstimatedCost: Math.round(totalEstimatedCost * 100) / 100,
          totalActualCost: Math.round(totalActualCost * 100) / 100,
          totalProfitability: Math.round(totalProfitability * 100) / 100,
          profitMargin: Math.round(profitMargin * 100) / 100,
          costVariance: Math.round(costVariance * 100) / 100,
          costVariancePercentage: Math.round(costVariancePercentage * 100) / 100,
          itemCount: totalItems,
          projectCount: uniqueProjects,
          vendorCount: vendors.length,
          averageProjectValue: uniqueProjects > 0 ? Math.round((totalWorkAssigned / uniqueProjects) * 100) / 100 : 0,
          averageProfitabilityPerProject: uniqueProjects > 0 ? Math.round((totalProfitability / uniqueProjects) * 100) / 100 : 0,
          averageCostPerItem: totalItems > 0 ? Math.round((totalActualCost / totalItems) * 100) / 100 : 0,
          costPerProject: uniqueProjects > 0 ? Math.round((totalActualCost / uniqueProjects) * 100) / 100 : 0,
          costPerDollarWorkAssigned: totalWorkAssigned > 0 ? Math.round((totalActualCost / totalWorkAssigned) * 100) / 100 : 0,
          profitableProjectsCount: profitableProjects,
          unprofitableProjectsCount: uniqueProjects - profitableProjects,
          profitableProjectsPercentage: uniqueProjects > 0 ? Math.round((profitableProjects / uniqueProjects) * 100) : 0,
          unprofitableProjectsPercentage: uniqueProjects > 0 ? Math.round(((uniqueProjects - profitableProjects) / uniqueProjects) * 100) : 0,
        },
        vendors,
        projects,
        insights: {
          topPerformer: topPerformer ? { vendorName: topPerformer.vendorName, profitability: topPerformer.totalProfitability } : null,
          mostEfficient: mostEfficientVendor ? { vendorName: mostEfficientVendor.vendorName, costVariance: mostEfficientVendor.costVariancePercentage } : null,
          needsImprovement: needsImprovementVendor ? { vendorName: needsImprovementVendor.vendorName, issues: needsImprovementVendor.totalProfitability < 0 ? ['Negative profitability'] : ['High cost variance'] } : null,
          recommendations,
        },
        benchmarking: {
          categoryProfitMargin: Math.round(profitMargin * 100) / 100,
          overallAverageProfitMargin: Math.round(overallAverageProfitMargin * 100) / 100,
          categoryCostVariance: Math.round(costVariancePercentage * 100) / 100,
          overallAverageCostVariance: Math.round(overallAverageCostVariance * 100) / 100,
          categoryVolume: Math.round(totalWorkAssigned * 100) / 100,
          overallAverageVolume: Math.round(overallAverageVolume * 100) / 100,
          isAboveAverage: {
            profitMargin: profitMargin >= overallAverageProfitMargin,
            costVariance: costVariancePercentage >= overallAverageCostVariance, // Positive variance is better
            volume: totalWorkAssigned >= overallAverageVolume,
          },
        },
        trends: {
          volumeTrend: 'stable' as const, // Would need historical data
          profitabilityTrend: 'stable' as const,
          costTrend: 'stable' as const,
        },
        distribution: {
          profitableProjectsPercentage: uniqueProjects > 0 ? Math.round((profitableProjects / uniqueProjects) * 100) : 0,
          unprofitableProjectsPercentage: uniqueProjects > 0 ? Math.round(((uniqueProjects - profitableProjects) / uniqueProjects) * 100) : 0,
          projectStatusDistribution: statusCounts,
        },
      },
    });
  } catch (error) {
    console.error('[Category API] Error fetching category data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch category data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

