import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { eq, and, isNull, inArray } from 'drizzle-orm';

/**
 * GET /api/order-approvals/approved-batch
 * Get all approved order approvals for all items in an order
 * Query params: orderId (required), customerId (optional)
 * 
 * Returns a map of orderItemId -> array of approved approvals for that item.
 * Only returns approvals where stage = 'approved' and deletedAt IS NULL.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const orderId = searchParams.get('orderId');
    const customerId = searchParams.get('customerId');

    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId query parameter is required' },
        { status: 400 }
      );
    }

    // Build where conditions
    const whereConditions = [
      eq(schema.orderApprovals.stage, 'approved'),
      isNull(schema.orderApprovals.deletedAt), // Only non-deleted approvals
    ];

    // Add customerId filter if provided
    if (customerId) {
      whereConditions.push(eq(schema.orderApprovals.customerId, customerId));
    }

    // First, get all order items for this order to get their IDs
    const orderItems = await db
      .select({
        id: schema.orderItems.id,
      })
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, orderId));

    if (orderItems.length === 0) {
      return NextResponse.json({
        success: true,
        data: {},
      });
    }

    const orderItemIds = orderItems.map(item => item.id);

    // Fetch all approved approvals for all items in this order
    const approvedApprovals = await db
      .select({
        orderItemId: schema.orderApprovalItems.orderItemId,
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
      .where(
        and(
          inArray(schema.orderApprovalItems.orderItemId, orderItemIds),
          ...whereConditions
        )
      );

    // Group approvals by orderItemId
    const approvalsByItemId = new Map<string, any[]>();
    for (const approval of approvedApprovals) {
      const itemId = approval.orderItemId;
      if (!approvalsByItemId.has(itemId)) {
        approvalsByItemId.set(itemId, []);
      }
      approvalsByItemId.get(itemId)!.push({
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
      });
    }

    // Convert Map to object for JSON response
    const data: Record<string, any[]> = {};
    for (const [itemId, approvals] of approvalsByItemId.entries()) {
      data[itemId] = approvals;
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching approved approvals batch:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch approved approvals',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

