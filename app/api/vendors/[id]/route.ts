import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, isNotNull, sql, and, isNull } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const vendorId = params.id;

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

    // Calculate performance metrics from order_items
    // Use the same calculation as analytics API: prioritize negotiatedVendorAmount from approved approvals
    const metricsData = await db
      .select({
        totalWorkAssigned: sql<number>`COALESCE(SUM(CAST(${schema.orderItems.totalWorkAssignedToVendor} AS NUMERIC)), 0)`,
        totalEstimatedCost: sql<number>`COALESCE(SUM(CAST(${schema.orderItems.estimatedVendorCost} AS NUMERIC)), 0)`,
        // Use amount from orderApprovalItems: negotiatedVendorAmount (approved amount) if available, otherwise amount (snapshot)
        // Fall back to vendorBillingToDate if no approved approval exists
        // This matches the calculation in /api/vendors/analytics/route.ts
        totalActualCost: sql<number>`
          COALESCE(
            SUM(
              CAST(
                COALESCE(
                  (
                    SELECT COALESCE(
                      CAST(oai.negotiated_vendor_amount AS NUMERIC),
                      CAST(oai.amount AS NUMERIC)
                    )
                    FROM order_approval_items oai
                    INNER JOIN order_approvals oa ON oai.order_approval_id = oa.id
                    INNER JOIN vendors v ON oa.vendor_id = v.id
                    WHERE oai.order_item_id = ${schema.orderItems.id}
                      AND oa.stage = 'approved'
                      AND oa.deleted_at IS NULL
                      AND v.name = ${schema.orderItems.vendorName1}
                    ORDER BY oa.updated_at DESC
                    LIMIT 1
                  ),
                  CAST(${schema.orderItems.vendorBillingToDate} AS NUMERIC)
                ) AS NUMERIC
              )
            ),
            0
          )
        `,
        totalProfitability: sql<number>`COALESCE(SUM(CAST(${schema.orderItems.vendorSavingsDeficit} AS NUMERIC)), 0)`,
        itemCount: sql<number>`COUNT(*)`,
        projectCount: sql<number>`COUNT(DISTINCT ${schema.orderItems.orderId})`,
      })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
      .innerJoin(schema.customers, eq(schema.orders.customerId, schema.customers.dbxCustomerId))
      .where(
        and(
          eq(schema.orderItems.vendorName1, vendor.name),
          isNotNull(schema.orderItems.vendorName1),
          isNull(schema.customers.deletedAt)
        )
      );

    const metrics = metricsData[0] || {
      totalWorkAssigned: 0,
      totalEstimatedCost: 0,
      totalActualCost: 0,
      totalProfitability: 0,
      itemCount: 0,
      projectCount: 0,
    };

    const totalWorkAssigned = Number(metrics.totalWorkAssigned) || 0;
    const totalEstimatedCost = Number(metrics.totalEstimatedCost) || 0;
    const totalActualCost = Number(metrics.totalActualCost) || 0;
    const itemCount = Number(metrics.itemCount) || 0;
    const projectCount = Number(metrics.projectCount) || 0;

    // Calculate profitability: totalWorkAssigned - totalActualCost
    // Use computed value instead of stored vendorSavingsDeficit which may be 0 or not populated
    const totalProfitability = totalWorkAssigned - totalActualCost;

    // Calculate cost variance
    const costVariance = totalEstimatedCost - totalActualCost;
    const costVariancePercentage = totalEstimatedCost > 0 
      ? (costVariance / totalEstimatedCost) * 100 
      : 0;

    // Calculate profit margin
    const profitMargin = totalWorkAssigned > 0 
      ? (totalProfitability / totalWorkAssigned) * 100 
      : 0;

    // Calculate cost accuracy score (0-100, based on variance percentage)
    // Perfect accuracy (0% variance) = 100, ±5% = 95, ±10% = 90, ±15% = 85, etc.
    const costAccuracyScore = Math.max(0, Math.min(100, 100 - Math.abs(costVariancePercentage) * 2));

    // Calculate profitability score (0-100, based on profit margin)
    // 15%+ margin = 100, 10% = 67, 5% = 33, 0% = 0, negative = 0
    const profitabilityScore = Math.max(0, Math.min(100, (profitMargin / 15) * 100));

    // Overall performance score (weighted: 40% cost accuracy, 40% profitability, 20% reliability)
    // Reliability score is placeholder (defaults to 80 for now)
    const reliabilityScore = 80; // Placeholder until we have completion rate data
    const overallPerformanceScore = (costAccuracyScore * 0.4) + (profitabilityScore * 0.4) + (reliabilityScore * 0.2);

    // Determine risk level
    // Note: For cost variance, negative (over budget) is bad, positive (under budget) is good
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (totalProfitability < 0 || costVariancePercentage < -15 || profitMargin < 0) {
      // High risk: negative profitability, over budget by >15%, or negative profit margin
      riskLevel = 'high';
    } else if (costVariancePercentage < -10 || profitMargin < 5) {
      // Medium risk: over budget by 10-15% or low profit margin
      riskLevel = 'medium';
    }

    return NextResponse.json({
      success: true,
      data: {
        ...vendor,
        performanceMetrics: {
          totalWorkAssigned,
          totalEstimatedCost,
          totalActualCost,
          totalProfitability,
          costVariance,
          costVariancePercentage: Math.round(costVariancePercentage * 100) / 100,
          profitMargin: Math.round(profitMargin * 100) / 100,
          itemCount,
          projectCount,
          costAccuracyScore: Math.round(costAccuracyScore * 100) / 100,
          profitabilityScore: Math.round(profitabilityScore * 100) / 100,
          reliabilityScore,
          overallPerformanceScore: Math.round(overallPerformanceScore * 100) / 100,
          riskLevel,
        },
      },
    });
  } catch (error) {
    console.error('[Vendors API] Error fetching vendor:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const vendorId = params.id;
    const body = await request.json();
    const { name, email, phone, contactPerson, address, city, state, zip, category, status, notes, specialties } = body;

    // Check if vendor exists
    const [existing] = await db
      .select()
      .from(schema.vendors)
      .where(eq(schema.vendors.id, vendorId))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    // If name is being changed, check for duplicates
    if (name && name.trim() !== existing.name) {
      const duplicate = await db
        .select()
        .from(schema.vendors)
        .where(eq(schema.vendors.name, name.trim()))
        .limit(1);

      if (duplicate.length > 0) {
        return NextResponse.json(
          { error: 'Vendor with this name already exists' },
          { status: 409 }
        );
      }
    }

    // Update vendor
    const [updatedVendor] = await db
      .update(schema.vendors)
      .set({
        name: name?.trim() || existing.name,
        email: email !== undefined ? (email?.trim() || null) : existing.email,
        phone: phone !== undefined ? (phone?.trim() || null) : existing.phone,
        contactPerson: contactPerson !== undefined ? (contactPerson?.trim() || null) : existing.contactPerson,
        address: address !== undefined ? (address?.trim() || null) : existing.address,
        city: city !== undefined ? (city?.trim() || null) : existing.city,
        state: state !== undefined ? (state?.trim() || null) : existing.state,
        zip: zip !== undefined ? (zip?.trim() || null) : existing.zip,
        category: category !== undefined ? (category?.trim() || null) : existing.category,
        status: status !== undefined ? (status as 'active' | 'inactive') : existing.status,
        notes: notes !== undefined ? (notes?.trim() || null) : existing.notes,
        specialties: specialties !== undefined ? (Array.isArray(specialties) ? specialties : null) : existing.specialties,
        updatedAt: new Date(),
      })
      .where(eq(schema.vendors.id, vendorId))
      .returning();

    return NextResponse.json({
      success: true,
      data: updatedVendor,
    });
  } catch (error) {
    console.error('[Vendors API] Error updating vendor:', error);
    return NextResponse.json(
      { error: 'Failed to update vendor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const vendorId = params.id;

    // Check if vendor exists
    const [existing] = await db
      .select()
      .from(schema.vendors)
      .where(eq(schema.vendors.id, vendorId))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    // Soft delete: set deletedAt timestamp
    const [deletedVendor] = await db
      .update(schema.vendors)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.vendors.id, vendorId))
      .returning();

    return NextResponse.json({
      success: true,
      data: deletedVendor,
      message: 'Vendor deleted successfully',
    });
  } catch (error) {
    console.error('[Vendors API] Error deleting vendor:', error);
    return NextResponse.json(
      { error: 'Failed to delete vendor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

