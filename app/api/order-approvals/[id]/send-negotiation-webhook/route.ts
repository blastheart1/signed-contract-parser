import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { eq } from 'drizzle-orm';
import { buildOrderApprovalNegotiationEmailPayload } from '@/lib/order-approval-email';

const HARD_CODED_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/3889978/u09vu4o/';

const COOLDOWN_MS = 15_000;
const lastSentAt = new Map<string, number>();

function isInCooldown(approvalId: string): boolean {
  const at = lastSentAt.get(approvalId);
  if (!at) return false;
  if (Date.now() - at < COOLDOWN_MS) return true;
  lastSentAt.delete(approvalId);
  return false;
}

function setCooldown(approvalId: string): void {
  lastSentAt.set(approvalId, Date.now());
  if (lastSentAt.size > 500) {
    const cutoff = Date.now() - COOLDOWN_MS;
    for (const [id, t] of lastSentAt.entries()) {
      if (t < cutoff) lastSentAt.delete(id);
    }
  }
}

/**
 * POST /api/order-approvals/[id]/send-negotiation-webhook
 * Send the "negotiation" email payload to Zapier (emailType: 'negotiation'), then set stage to negotiating and sentAt.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (user.role === 'vendor') {
      return NextResponse.json({ error: 'Vendors cannot send negotiation emails' }, { status: 403 });
    }

    const approvalId = params.id;

    let sendTo: string | undefined;
    let cc: string | undefined;
    try {
      const body = await request.json();
      if (body && typeof body.sendTo === 'string') sendTo = body.sendTo;
      if (body && typeof body.cc === 'string') cc = body.cc;
    } catch {
      // ignore
    }

    if (isInCooldown(approvalId)) {
      return NextResponse.json(
        { error: 'Please wait a moment before sending again to avoid duplicate webhooks.' },
        { status: 429 }
      );
    }

    const payload = await buildOrderApprovalNegotiationEmailPayload(approvalId);
    if (!payload) {
      return NextResponse.json({ error: 'Order approval not found' }, { status: 404 });
    }

    if (!payload.htmlEmail || !payload.referenceNo || !payload.approvalId) {
      return NextResponse.json(
        { error: 'Negotiation email payload incomplete. Fix the order approval details before sending.' },
        { status: 422 }
      );
    }

    const webhookPayload = {
      ...payload,
      emailType: 'negotiation' as const,
      ...(sendTo ? { sendTo } : {}),
      ...(cc ? { cc } : {}),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    const webhookResponse = await fetch(HARD_CODED_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!webhookResponse.ok) {
      const responseText = await webhookResponse.text();
      return NextResponse.json(
        {
          error: 'Webhook call failed',
          status: webhookResponse.status,
          message: responseText || 'Webhook returned non-200 response',
        },
        { status: 502 }
      );
    }

    setCooldown(approvalId);

    // Move to negotiating and set sentAt
    const [existing] = await db
      .select()
      .from(schema.orderApprovals)
      .where(eq(schema.orderApprovals.id, approvalId))
      .limit(1);

    if (existing && !existing.deletedAt) {
      await db
        .update(schema.orderApprovals)
        .set({
          stage: 'negotiating',
          sentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.orderApprovals.id, approvalId));
    }

    return NextResponse.json({
      success: true,
      message: 'Negotiation email sent and approval moved to Negotiating',
      data: {
        approvalId,
        referenceNo: payload.referenceNo,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Webhook request timed out' },
        { status: 504 }
      );
    }
    console.error('Error sending negotiation webhook:', error);
    return NextResponse.json(
      {
        error: 'Failed to send negotiation email',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
