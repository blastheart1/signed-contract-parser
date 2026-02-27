import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { buildOrderApprovalEmailPayload } from '@/lib/order-approval-email';

/**
 * GET /api/order-approvals/[id]/preview-email
 * Generate an order approval email HTML preview without sending anything.
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

    if (user.role === 'vendor') {
      return NextResponse.json({ error: 'Vendors cannot preview order approval emails' }, { status: 403 });
    }

    const approvalId = params.id;

    const payload = await buildOrderApprovalEmailPayload(approvalId);
    if (!payload) {
      return NextResponse.json({ error: 'Order approval not found' }, { status: 404 });
    }

    if (!payload.htmlEmail || !payload.referenceNo || !payload.approvalId) {
      return NextResponse.json(
        { error: 'Failed to generate email preview: payload incomplete' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        approvalId: payload.approvalId,
        referenceNo: payload.referenceNo,
        htmlEmail: payload.htmlEmail,
      },
    });
  } catch (error) {
    console.error('Error generating order approval email preview:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate email preview',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

