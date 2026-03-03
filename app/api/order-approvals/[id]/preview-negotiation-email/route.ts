import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { buildOrderApprovalNegotiationEmailPayload } from '@/lib/order-approval-email';

/**
 * GET /api/order-approvals/[id]/preview-negotiation-email
 * Generate the "Send for Negotiation" email HTML preview (vendor to set RATE).
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
      return NextResponse.json({ error: 'Vendors cannot preview negotiation emails' }, { status: 403 });
    }

    const approvalId = params.id;

    const payload = await buildOrderApprovalNegotiationEmailPayload(approvalId);
    if (!payload) {
      return NextResponse.json({ error: 'Order approval not found' }, { status: 404 });
    }

    if (!payload.htmlEmail || !payload.referenceNo || !payload.approvalId) {
      return NextResponse.json(
        { error: 'Failed to generate negotiation email preview: payload incomplete' },
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
    console.error('Error generating negotiation email preview:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate negotiation email preview',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
