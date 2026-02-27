import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { buildOrderApprovalEmailPayload } from '@/lib/order-approval-email';

// Temporary testing override per request. Replace with env-based config after QA.
const HARD_CODED_TEST_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/3889978/u09vu4o/';

/** Cooldown in ms; reject duplicate triggers for same approval within this window. */
const COOLDOWN_MS = 15_000;

/** In-memory cooldown per approval ID (cleaned after use). */
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
  // Prune old entries to avoid unbounded growth
  if (lastSentAt.size > 500) {
    const cutoff = Date.now() - COOLDOWN_MS;
    for (const [id, t] of lastSentAt.entries()) {
      if (t < cutoff) lastSentAt.delete(id);
    }
  }
}

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
      return NextResponse.json({ error: 'Vendors cannot send test webhooks' }, { status: 403 });
    }

    const approvalId = params.id;

    if (isInCooldown(approvalId)) {
      return NextResponse.json(
        { error: 'Please wait a moment before sending again to avoid duplicate webhooks.' },
        { status: 429 }
      );
    }

    const payload = await buildOrderApprovalEmailPayload(approvalId);
    if (!payload) {
      return NextResponse.json({ error: 'Order approval not found' }, { status: 404 });
    }

    // Basic validation so we don't send obviously broken payloads.
    if (!payload.htmlEmail || !payload.referenceNo || !payload.approvalId) {
      return NextResponse.json(
        { error: 'Email payload generation failed or is incomplete. Fix the order approval details before sending a test email.' },
        { status: 422 }
      );
    }

    const webhookUrl = HARD_CODED_TEST_WEBHOOK_URL;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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

    return NextResponse.json({
      success: true,
      message: 'Test webhook sent successfully',
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
    console.error('Error sending test webhook:', error);
    return NextResponse.json(
      {
        error: 'Failed to send test webhook',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
