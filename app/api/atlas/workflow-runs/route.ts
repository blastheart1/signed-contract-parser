import { NextResponse } from 'next/server';
import { getDashboardRows, createEmployeeAndRun } from '@/lib/atlas/queries';
import type { CreateRunInput } from '@/lib/atlas/queries';

export async function GET() {
  try {
    const rows = await getDashboardRows();
    return NextResponse.json(rows);
  } catch (err) {
    console.error('[atlas/workflow-runs GET]', err);
    return NextResponse.json({ error: 'Failed to load workflow runs' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateRunInput;
    const result = await createEmployeeAndRun(body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('[atlas/workflow-runs POST]', err);
    return NextResponse.json({ error: 'Failed to create workflow run' }, { status: 500 });
  }
}
