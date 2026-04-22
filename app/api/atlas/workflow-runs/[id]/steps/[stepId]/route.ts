import { NextRequest, NextResponse } from 'next/server';
import { markStepDone } from '@/lib/atlas/queries';
import { requireAtlasAuth } from '@/lib/atlas/auth-guard';
import { logAudit } from '@/lib/atlas/audit';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; stepId: string } },
) {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json() as { action: 'mark_done' | 'override' };
    if (body.action !== 'mark_done' && body.action !== 'override') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    await markStepDone(params.stepId, params.id);
    await logAudit({
      actorId: auth.user.id,
      actorLabel: auth.user.username,
      action: 'step.mark_done',
      entityType: 'workflow_run',
      entityId: params.stepId,
      detail: { runId: params.id },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[atlas/workflow-runs/[id]/steps/[stepId] PATCH]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
