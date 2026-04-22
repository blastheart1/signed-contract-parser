import { NextResponse } from 'next/server';
import { requireAtlasAuth } from '@/lib/atlas/auth-guard';
import { logAudit } from '@/lib/atlas/audit';
import { advanceRun } from '@/lib/atlas/engine/advance-run';

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await advanceRun(params.id);

    await logAudit({
      actorId: auth.user.id,
      actorLabel: auth.user.username,
      action: 'workflow_run.advance',
      entityType: 'workflow_run',
      entityId: params.id,
      detail: { result },
    });

    return NextResponse.json({ result });
  } catch (err) {
    console.error('[atlas/workflow-runs/[id]/advance POST]', err);
    return NextResponse.json({ error: 'Failed to advance run' }, { status: 500 });
  }
}
