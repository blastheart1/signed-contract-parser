import { NextResponse } from 'next/server';
import { getDashboardMetrics } from '@/lib/atlas/queries';
import { requireAtlasAuth } from '@/lib/atlas/auth-guard';

export async function GET() {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;
  try {
    const metrics = await getDashboardMetrics();
    return NextResponse.json(metrics);
  } catch (err) {
    console.error('[atlas/metrics GET]', err);
    return NextResponse.json({ error: 'Failed to load metrics' }, { status: 500 });
  }
}
