import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { eq, and, isNull, inArray } from 'drizzle-orm';

/**
 * GET /api/order-approvals/[id]
 * Get a single order approval with related data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const approvalId = params.id;

    // Fetch approval with related data
    // Note: orderId is nullable, so order join may return null
    const [approval] = await db
      .select({
        id: schema.orderApprovals.id,
        referenceNo: schema.orderApprovals.referenceNo,
        vendorId: schema.orderApprovals.vendorId,
        vendorName: schema.vendors.name,
        vendorEmail: schema.vendors.email,
        customerId: schema.orderApprovals.customerId,
        customerName: schema.customers.clientName,
        orderId: schema.orderApprovals.orderId,
        orderNo: schema.orders.orderNo, // May be null if orderId is null
        stage: schema.orderApprovals.stage,
        pmApproved: schema.orderApprovals.pmApproved,
        vendorApproved: schema.orderApprovals.vendorApproved,
        vendorApprovedAt: schema.orderApprovals.vendorApprovedAt,
        dateCreated: schema.orderApprovals.dateCreated,
        sentAt: schema.orderApprovals.sentAt,
        createdBy: schema.orderApprovals.createdBy,
        createdByEmail: schema.users.email,
        updatedAt: schema.orderApprovals.updatedAt,
        deletedAt: schema.orderApprovals.deletedAt,
      })
      .from(schema.orderApprovals)
      .leftJoin(schema.vendors, eq(schema.orderApprovals.vendorId, schema.vendors.id))
      .leftJoin(schema.customers, eq(schema.orderApprovals.customerId, schema.customers.dbxCustomerId))
      .leftJoin(schema.orders, eq(schema.orderApprovals.orderId, schema.orders.id))
      .leftJoin(schema.users, eq(schema.orderApprovals.createdBy, schema.users.id))
      .where(eq(schema.orderApprovals.id, approvalId))
      .limit(1);

    if (!approval) {
      return NextResponse.json({ error: 'Order approval not found' }, { status: 404 });
    }

    // Vendor users can only see their own approvals
    if (user.role === 'vendor') {
      if (user.email) {
        const vendorRecord = await db
          .select()
          .from(schema.vendors)
          .where(eq(schema.vendors.email, user.email))
          .limit(1);
        
        if (vendorRecord.length === 0 || vendorRecord[0].id !== approval.vendorId) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Fetch selected order items - include snapshot fields (qty, rate, amount) and negotiatedVendorAmount
    let selectedItems;
    try {
      selectedItems = await db
        .select({
          id: schema.orderApprovalItems.id,
          orderItemId: schema.orderApprovalItems.orderItemId,
          qty: schema.orderApprovalItems.qty,
          rate: schema.orderApprovalItems.rate,
          amount: schema.orderApprovalItems.amount,
          negotiatedVendorAmount: schema.orderApprovalItems.negotiatedVendorAmount,
          orderItem: schema.orderItems,
        })
        .from(schema.orderApprovalItems)
        .innerJoin(schema.orderItems, eq(schema.orderApprovalItems.orderItemId, schema.orderItems.id))
        .where(eq(schema.orderApprovalItems.orderApprovalId, approvalId));
    } catch (error: any) {
      // If snapshot columns don't exist, select without them
      if (error?.cause?.code === '42703' || error?.message?.includes('does not exist')) {
        try {
          selectedItems = await db
            .select({
              id: schema.orderApprovalItems.id,
              orderItemId: schema.orderApprovalItems.orderItemId,
              negotiatedVendorAmount: schema.orderApprovalItems.negotiatedVendorAmount,
              orderItem: schema.orderItems,
            })
            .from(schema.orderApprovalItems)
            .innerJoin(schema.orderItems, eq(schema.orderApprovalItems.orderItemId, schema.orderItems.id))
            .where(eq(schema.orderApprovalItems.orderApprovalId, approvalId));
        } catch (fallbackError: any) {
          // If negotiatedVendorAmount also doesn't exist, select base fields only
          if (fallbackError?.cause?.code === '42703' || fallbackError?.message?.includes('does not exist')) {
            selectedItems = await db
              .select({
                id: schema.orderApprovalItems.id,
                orderItemId: schema.orderApprovalItems.orderItemId,
                orderItem: schema.orderItems,
              })
              .from(schema.orderApprovalItems)
              .innerJoin(schema.orderItems, eq(schema.orderApprovalItems.orderItemId, schema.orderItems.id))
              .where(eq(schema.orderApprovalItems.orderApprovalId, approvalId));
          } else {
            throw fallbackError;
          }
        }
      } else {
        throw error;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...approval,
        selectedItems: selectedItems.map(item => ({
          id: item.id,
          orderItemId: item.orderItemId,
          qty: (item as any).qty || null,
          rate: (item as any).rate || null,
          amount: (item as any).amount || null,
          negotiatedVendorAmount: (item as any).negotiatedVendorAmount || null,
          orderItem: item.orderItem,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching order approval:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch order approval',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/order-approvals/[id]
 * Update an order approval (stage, approvals, etc.)
 * Body: { stage?, pmApproved?, vendorApproved?, disclaimerAccepted? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const approvalId = params.id;
    const body = await request.json();
    const { stage, pmApproved, vendorApproved, disclaimerAccepted } = body;

    // Fetch existing approval
    const [existing] = await db
      .select()
      .from(schema.orderApprovals)
      .where(eq(schema.orderApprovals.id, approvalId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Order approval not found' }, { status: 404 });
    }

    // Check if deleted
    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Cannot update deleted approval' }, { status: 400 });
    }

    // Check if approved (read-only)
    if (existing.stage === 'approved') {
      return NextResponse.json({ error: 'Approved orders are read-only' }, { status: 400 });
    }

    // Vendor users can only approve (set vendorApproved)
    if (user.role === 'vendor') {
      if (user.email) {
        const vendorRecord = await db
          .select()
          .from(schema.vendors)
          .where(eq(schema.vendors.email, user.email))
          .limit(1);
        
        if (vendorRecord.length === 0 || vendorRecord[0].id !== existing.vendorId) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      // Vendors can only set vendorApproved, not change stage or pmApproved
      if (stage !== undefined || pmApproved !== undefined) {
        return NextResponse.json({ error: 'Vendors can only approve/retract items' }, { status: 403 });
      }

      // Vendors can toggle vendorApproved (approve or retract) in negotiating stage
      if (existing.stage !== 'negotiating') {
        return NextResponse.json({ error: 'Vendors can only approve/retract in negotiating stage' }, { status: 400 });
      }
    }

    // Validate stage transitions
    if (stage !== undefined) {
      const validStages = ['draft', 'negotiating', 'approved'];
      if (!validStages.includes(stage)) {
        return NextResponse.json({ error: 'Invalid stage' }, { status: 400 });
      }

      // Only PM can change stages
      if (user.role === 'vendor') {
        return NextResponse.json({ error: 'Vendors cannot change stages' }, { status: 403 });
      }

      // Check if stage transition is valid (can go forward or backward one step)
      const currentStageIndex = validStages.indexOf(existing.stage);
      const newStageIndex = validStages.indexOf(stage);
      
      if (Math.abs(newStageIndex - currentStageIndex) > 1) {
        return NextResponse.json(
          { error: 'Cannot skip stages. Can only move forward or backward one step.' },
          { status: 400 }
        );
      }

      // If moving to 'approved', both approvals must be true
      if (stage === 'approved') {
        const currentPmApproved = pmApproved !== undefined ? pmApproved : existing.pmApproved;
        const currentVendorApproved = vendorApproved !== undefined ? vendorApproved : existing.vendorApproved;
        
        if (!currentPmApproved || !currentVendorApproved) {
          return NextResponse.json(
            { error: 'Both PM and Vendor must approve before moving to approved stage' },
            { status: 400 }
          );
        }
      }
    }

    // Build update object
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (stage !== undefined) {
      updateData.stage = stage;
    }
    if (pmApproved !== undefined && user.role !== 'vendor') {
      updateData.pmApproved = pmApproved;
    }
    if (vendorApproved !== undefined) {
      updateData.vendorApproved = vendorApproved;
    }
    // Record time of approval when vendor approves with disclaimer accepted (optional for backward compatibility)
    if (user.role === 'vendor' && vendorApproved === true && disclaimerAccepted === true) {
      updateData.vendorApprovedAt = new Date();
    }

    // Update approval
    const [updated] = await db
      .update(schema.orderApprovals)
      .set(updateData)
      .where(eq(schema.orderApprovals.id, approvalId))
      .returning();

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Error updating order approval:', error);
    return NextResponse.json(
      {
        error: 'Failed to update order approval',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/order-approvals/[id]
 * Soft delete an order approval
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Only non-vendor roles can delete
    if (user.role === 'vendor') {
      return NextResponse.json({ error: 'Vendors cannot delete approvals' }, { status: 403 });
    }

    const approvalId = params.id;

    // Check if already deleted
    const [existing] = await db
      .select()
      .from(schema.orderApprovals)
      .where(eq(schema.orderApprovals.id, approvalId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Order approval not found' }, { status: 404 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Approval already deleted' }, { status: 400 });
    }

    // Soft delete
    const [deleted] = await db
      .update(schema.orderApprovals)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.orderApprovals.id, approvalId))
      .returning();

    return NextResponse.json({
      success: true,
      data: deleted,
    });
  } catch (error) {
    console.error('Error deleting order approval:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete order approval',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

