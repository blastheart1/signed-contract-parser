import { NextResponse } from 'next/server';
import { getDashboardMetrics } from '@/lib/atlas/queries';

export async function GET() {
  try {
    const metrics = await getDashboardMetrics();
    return NextResponse.json(metrics);
  } catch (err) {
    console.error('[atlas/metrics GET]', err);
    return NextResponse.json({ error: 'Failed to load metrics' }, { status: 500 });
  }
}
