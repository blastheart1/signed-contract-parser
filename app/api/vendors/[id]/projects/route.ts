import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, isNotNull, sql, and, isNull } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const vendorId = params.id;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);
    const sortBy = searchParams.get('sortBy') || 'orderNo';

    // Get vendor name
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

    // Get all projects using this vendor
    // Use the same calculation as analytics API: prioritize negotiatedVendorAmount from approved approvals
    const projectsData = await db
      .select({
        orderId: schema.orderItems.orderId,
        orderNo: schema.orders.orderNo,
        customerName: schema.customers.clientName,
        customerId: schema.customers.dbxCustomerId,
        projectStartDate: schema.orders.projectStartDate,
        projectEndDate: schema.orders.projectEndDate,
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
      )
      .groupBy(
        schema.orderItems.orderId,
        schema.orders.orderNo,
        schema.customers.clientName,
        schema.customers.dbxCustomerId,
        schema.orders.projectStartDate,
        schema.orders.projectEndDate
      );

    // Process and calculate metrics
    const processedProjects = projectsData.map(project => {
      const totalWorkAssigned = Number(project.totalWorkAssigned) || 0;
      const totalEstimatedCost = Number(project.totalEstimatedCost) || 0;
      const totalActualCost = Number(project.totalActualCost) || 0;

      // Calculate profitability: totalWorkAssigned - totalActualCost
      // Use computed value instead of stored vendorSavingsDeficit which may be 0 or not populated
      const totalProfitability = totalWorkAssigned - totalActualCost;

      // Calculate profit margin
      const profitMargin = totalWorkAssigned > 0 
        ? (totalProfitability / totalWorkAssigned) * 100 
        : 0;

      return {
        orderId: project.orderId,
        orderNo: project.orderNo || 'N/A',
        customerName: project.customerName || 'Unknown',
        customerId: project.customerId || '',
        totalWorkAssigned,
        totalEstimatedCost,
        totalActualCost,
        profitability: totalProfitability,
        profitMargin: Math.round(profitMargin * 100) / 100,
        projectStartDate: project.projectStartDate || null,
        projectEndDate: project.projectEndDate || null,
      };
    });

    // Sort projects
    processedProjects.sort((a, b) => {
      switch (sortBy) {
        case 'orderNo':
          return (a.orderNo || '').localeCompare(b.orderNo || '');
        case 'customerName':
          return (a.customerName || '').localeCompare(b.customerName || '');
        case 'totalWorkAssigned':
          return b.totalWorkAssigned - a.totalWorkAssigned;
        case 'profitability':
          return b.profitability - a.profitability;
        case 'profitMargin':
          return b.profitMargin - a.profitMargin;
        default:
          return 0;
      }
    });

    // Paginate
    const total = processedProjects.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedProjects = processedProjects.slice(startIndex, endIndex);

    return NextResponse.json({
      success: true,
      data: paginatedProjects,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('[Vendors Projects API] Error fetching vendor projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendor projects', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

