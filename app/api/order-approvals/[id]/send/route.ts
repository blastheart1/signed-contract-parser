import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { eq } from 'drizzle-orm';

/**
 * PATCH /api/order-approvals/[id]/send
 * Send approval to vendor (change stage to 'negotiating')
 * Only allowed from 'draft' stage
 * Sets sent_at timestamp
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

    // Only non-vendor roles can send to vendor
    if (user.role === 'vendor') {
      return NextResponse.json({ error: 'Vendors cannot send approvals' }, { status: 403 });
    }

    const approvalId = params.id;

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
      return NextResponse.json({ error: 'Cannot send deleted approval' }, { status: 400 });
    }

    // Only allow sending from 'draft' stage
    if (existing.stage !== 'draft') {
      return NextResponse.json(
        { error: 'Can only send approvals from draft stage' },
        { status: 400 }
      );
    }

    // Verify at least one item is selected
    const selectedItems = await db
      .select()
      .from(schema.orderApprovalItems)
      .where(eq(schema.orderApprovalItems.orderApprovalId, approvalId))
      .limit(1);

    if (selectedItems.length === 0) {
      return NextResponse.json(
        { error: 'Cannot send approval without selected items' },
        { status: 400 }
      );
    }

    // Update approval: change stage to 'negotiating' and set sent_at
    const [updated] = await db
      .update(schema.orderApprovals)
      .set({
        stage: 'negotiating',
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.orderApprovals.id, approvalId))
      .returning();

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Approval sent to vendor successfully',
    });
  } catch (error) {
    console.error('Error sending approval to vendor:', error);
    return NextResponse.json(
      {
        error: 'Failed to send approval to vendor',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

