import { NextRequest, NextResponse } from 'next/server';
import { getAccessAccounts } from '@/lib/atlas/queries';
import { requireAtlasAuth } from '@/lib/atlas/auth-guard';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;
  try {
    const accounts = await getAccessAccounts(params.id);
    return NextResponse.json(accounts);
  } catch (err) {
    console.error('[atlas/employees/[id]/access GET]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
