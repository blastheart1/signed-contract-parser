import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { atlasWorkflowRuns, atlasWorkflowSteps } from '@/lib/db/schema';
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

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json() as { action?: string };
    const { action } = body;

    if (action !== 'retry' && action !== 'cancel' && action !== 'resume') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (action === 'retry') {
      await db
        .update(atlasWorkflowRuns)
        .set({ status: 'in-progress' })
        .where(eq(atlasWorkflowRuns.id, params.id));
      // Reset only failed steps for this run back to queued (pending)
      await db
        .update(atlasWorkflowSteps)
        .set({ status: 'queued' })
        .where(
          and(
            eq(atlasWorkflowSteps.runId, params.id),
            eq(atlasWorkflowSteps.status, 'failed'),
          ),
        );
    } else if (action === 'cancel') {
      await db
        .update(atlasWorkflowRuns)
        .set({ status: 'failed' })
        .where(eq(atlasWorkflowRuns.id, params.id));
    } else if (action === 'resume') {
      await db
        .update(atlasWorkflowRuns)
        .set({ status: 'in-progress' })
        .where(eq(atlasWorkflowRuns.id, params.id));
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[atlas/workflow-runs/[id] PATCH]', err);
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 });
  }
}
