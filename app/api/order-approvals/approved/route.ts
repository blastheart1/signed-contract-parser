import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * GET /api/order-approvals/approved
 * Get approved order approvals for a specific order item
 * Query params: orderItemId (required), customerId (optional)
 * 
 * Returns list of approved order approvals that include the specified order item.
 * Only returns approvals where stage = 'approved' and deletedAt IS NULL.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const orderItemId = searchParams.get('orderItemId');
    const customerId = searchParams.get('customerId');

    if (!orderItemId) {
      return NextResponse.json(
        { error: 'orderItemId query parameter is required' },
        { status: 400 }
      );
    }

    // Validate that orderItemId is a valid UUID (not a temporary ID like "item-84")
    // UUID format: 8-4-4-4-12 hex digits
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orderItemId)) {
      // Return empty array instead of error for temporary IDs
      // This is expected behavior - items with temporary IDs haven't been saved yet
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Build where conditions
    const whereConditions = [
      eq(schema.orderApprovalItems.orderItemId, orderItemId),
      eq(schema.orderApprovals.stage, 'approved'),
      isNull(schema.orderApprovals.deletedAt), // Only non-deleted approvals
    ];

    // Add customerId filter if provided
    if (customerId) {
      whereConditions.push(eq(schema.orderApprovals.customerId, customerId));
    }

    // Fetch approved order approvals that include this order item
    const approvedApprovals = await db
      .select({
        approvalId: schema.orderApprovals.id,
        referenceNo: schema.orderApprovals.referenceNo,
        vendorId: schema.orderApprovals.vendorId,
        vendorName: schema.vendors.name,
        negotiatedVendorAmount: schema.orderApprovalItems.negotiatedVendorAmount,
        approvedAt: schema.orderApprovals.updatedAt, // Use updatedAt as proxy for approvedAt
        snapshotData: {
          productService: schema.orderApprovalItems.productService,
          amount: schema.orderApprovalItems.amount,
          qty: schema.orderApprovalItems.qty,
          rate: schema.orderApprovalItems.rate,
        },
      })
      .from(schema.orderApprovalItems)
      .innerJoin(
        schema.orderApprovals,
        eq(schema.orderApprovalItems.orderApprovalId, schema.orderApprovals.id)
      )
      .innerJoin(
        schema.vendors,
        eq(schema.orderApprovals.vendorId, schema.vendors.id)
      )
      .where(and(...whereConditions));

    const filteredApprovals = approvedApprovals;

    // Format response
    const formattedData = filteredApprovals.map(approval => ({
      approvalId: approval.approvalId,
      referenceNo: approval.referenceNo,
      vendorId: approval.vendorId,
      vendorName: approval.vendorName,
      negotiatedVendorAmount: approval.negotiatedVendorAmount
        ? parseFloat(approval.negotiatedVendorAmount)
        : null,
      approvedAt: approval.approvedAt,
      snapshotData: {
        productService: approval.snapshotData.productService,
        amount: approval.snapshotData.amount
          ? parseFloat(approval.snapshotData.amount)
          : null,
        qty: approval.snapshotData.qty
          ? parseFloat(approval.snapshotData.qty)
          : null,
        rate: approval.snapshotData.rate
          ? parseFloat(approval.snapshotData.rate)
          : null,
      },
    }));

    return NextResponse.json({
      success: true,
      data: formattedData,
    });
  } catch (error) {
    console.error('Error fetching approved approvals:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch approved approvals',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

