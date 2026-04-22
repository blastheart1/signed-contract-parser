import { NextResponse } from 'next/server';
import { getRunDetail } from '@/lib/atlas/queries';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const run = await getRunDetail(params.id);
    if (!run) {
      return NextResponse.json({ error: 'Workflow run not found' }, { status: 404 });
    }
    return NextResponse.json(run);
  } catch (err) {
    console.error('[atlas/workflow-runs/[id] GET]', err);
    return NextResponse.json({ error: 'Failed to load workflow run' }, { status: 500 });
  }
}
