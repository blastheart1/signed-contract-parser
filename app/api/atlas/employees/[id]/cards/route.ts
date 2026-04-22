import { NextRequest, NextResponse } from 'next/server';
import { getCards, addCard } from '@/lib/atlas/queries';
import { requireAtlasAuth } from '@/lib/atlas/auth-guard';
import { AddCardSchema } from '@/lib/atlas/schemas';
import { logAudit } from '@/lib/atlas/audit';
import { z } from 'zod';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;
  try {
    const cards = await getCards(params.id);
    return NextResponse.json(cards);
  } catch (err) {
    console.error('[atlas/employees/[id]/cards GET]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;
  try {
    let body: z.infer<typeof AddCardSchema>;
    try { body = AddCardSchema.parse(await req.json()); }
    catch { return NextResponse.json({ error: 'Invalid input' }, { status: 400 }); }
    const cardData = { ...body, creditLimit: body.creditLimitDollars !== undefined ? Math.round(body.creditLimitDollars * 100) : undefined };
    const card = await addCard(params.id, cardData);
    await logAudit({
      actorId: auth.user.id,
      actorLabel: auth.user.username,
      action: 'card.add',
      entityType: 'card',
      entityId: card.id,
      detail: { employeeId: params.id, issuer: body.issuer },
    });
    return NextResponse.json(card, { status: 201 });
  } catch (err) {
    console.error('[atlas/employees/[id]/cards POST]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
