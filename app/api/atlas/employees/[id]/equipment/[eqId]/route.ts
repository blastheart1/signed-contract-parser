import { NextRequest, NextResponse } from 'next/server';
import { removeEquipment, returnEquipment } from '@/lib/atlas/queries';
import { requireAtlasAuth } from '@/lib/atlas/auth-guard';
import { logAudit } from '@/lib/atlas/audit';

export async function PATCH(req: NextRequest, { params }: { params: { eqId: string } }) {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json() as { action: 'return' };
    if (body.action === 'return') {
      await returnEquipment(params.eqId);
      await logAudit({
        actorId: auth.user.id,
        actorLabel: auth.user.username,
        action: 'equipment.return',
        entityType: 'equipment',
        entityId: params.eqId,
      });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[atlas/equipment/[eqId] PATCH]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { eqId: string } }) {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;
  try {
    await removeEquipment(params.eqId);
    await logAudit({
      actorId: auth.user.id,
      actorLabel: auth.user.username,
      action: 'equipment.remove',
      entityType: 'equipment',
      entityId: params.eqId,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[atlas/equipment/[eqId] DELETE]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
