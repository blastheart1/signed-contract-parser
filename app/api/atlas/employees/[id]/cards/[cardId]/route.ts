import { NextRequest, NextResponse } from 'next/server';
import { updateCardStatus } from '@/lib/atlas/queries';
import { requireAtlasAuth } from '@/lib/atlas/auth-guard';
import { logAudit } from '@/lib/atlas/audit';

const ACTION_MAP: Record<string, 'active' | 'suspended' | 'cancelled'> = {
  suspend: 'suspended',
  reactivate: 'active',
  cancel: 'cancelled',
};

export async function PATCH(req: NextRequest, { params }: { params: { cardId: string } }) {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json() as { status?: 'active' | 'suspended' | 'cancelled'; action?: string };
    const status: 'active' | 'suspended' | 'cancelled' | undefined =
      body.status ?? (body.action ? ACTION_MAP[body.action] : undefined);
    if (!status || !['active', 'suspended', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status or action' }, { status: 400 });
    }
    await updateCardStatus(params.cardId, status);
    await logAudit({
      actorId: auth.user.id,
      actorLabel: auth.user.username,
      action: 'card.status_change',
      entityType: 'card',
      entityId: params.cardId,
      detail: { status },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[atlas/cards/[cardId] PATCH]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
