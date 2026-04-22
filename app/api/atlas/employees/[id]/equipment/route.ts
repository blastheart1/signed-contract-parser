import { NextRequest, NextResponse } from 'next/server';
import { getEquipment, addEquipment } from '@/lib/atlas/queries';
import { requireAtlasAuth } from '@/lib/atlas/auth-guard';
import { AddEquipmentSchema } from '@/lib/atlas/schemas';
import { logAudit } from '@/lib/atlas/audit';
import { z } from 'zod';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;
  try {
    const equipment = await getEquipment(params.id);
    return NextResponse.json(equipment);
  } catch (err) {
    console.error('[atlas/employees/[id]/equipment GET]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;
  try {
    let body: z.infer<typeof AddEquipmentSchema>;
    try { body = AddEquipmentSchema.parse(await req.json()); }
    catch { return NextResponse.json({ error: 'Invalid input' }, { status: 400 }); }
    const item = await addEquipment(params.id, body);
    await logAudit({
      actorId: auth.user.id,
      actorLabel: auth.user.username,
      action: 'equipment.add',
      entityType: 'equipment',
      entityId: item.id,
      detail: { employeeId: params.id, type: body.type },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error('[atlas/employees/[id]/equipment POST]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
