import { NextRequest, NextResponse } from 'next/server';
import { updateAccessAccountStatus } from '@/lib/atlas/queries';
import { requireAtlasAuth } from '@/lib/atlas/auth-guard';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; accountId: string } },
) {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;
  try {
    let body: { status: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    if (!body?.status || typeof body.status !== 'string') {
      return NextResponse.json({ error: 'Missing status' }, { status: 400 });
    }
    await updateAccessAccountStatus(params.accountId, body.status);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[atlas/employees/[id]/access/[accountId] PATCH]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
