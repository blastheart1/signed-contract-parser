import { NextResponse } from 'next/server';
import { getManagerCandidates } from '@/lib/atlas/queries';
import { requireAtlasAuth } from '@/lib/atlas/auth-guard';

export async function GET() {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;
  try {
    const managers = await getManagerCandidates();
    return NextResponse.json(managers);
  } catch (err) {
    console.error('[atlas/managers GET]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
