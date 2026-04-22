import { NextResponse } from 'next/server';
import { createOffboardingRun } from '@/lib/atlas/queries';
import { requireAtlasAuth } from '@/lib/atlas/auth-guard';

export async function POST(req: Request) {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json() as { employeeId?: string };
    const { employeeId } = body;

    if (!employeeId || typeof employeeId !== 'string') {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }

    const runId = await createOffboardingRun(employeeId);
    return NextResponse.json({ runId }, { status: 201 });
  } catch (err) {
    console.error('[atlas/offboarding POST]', err);
    return NextResponse.json({ error: 'Failed to start offboarding' }, { status: 500 });
  }
}
