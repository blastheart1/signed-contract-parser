import { NextResponse } from 'next/server';
import { getDashboardRows, createEmployeeAndRun } from '@/lib/atlas/queries';
import { requireAtlasAuth } from '@/lib/atlas/auth-guard';
import { CreateRunInputSchema } from '@/lib/atlas/schemas';
import { logAudit } from '@/lib/atlas/audit';
import { z } from 'zod';

export async function GET() {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;
  try {
    const rows = await getDashboardRows();
    return NextResponse.json(rows);
  } catch (err) {
    console.error('[atlas/workflow-runs GET]', err);
    return NextResponse.json({ error: 'Failed to load workflow runs' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;
  try {
    let body: z.infer<typeof CreateRunInputSchema>;
    try { body = CreateRunInputSchema.parse(await req.json()); }
    catch { return NextResponse.json({ error: 'Invalid input' }, { status: 400 }); }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await createEmployeeAndRun(body as any);
    await logAudit({
      actorId: auth.user.id,
      actorLabel: auth.user.username,
      action: 'workflow_run.create',
      entityType: 'workflow_run',
      entityId: result.runId,
      detail: { employeeId: result.employeeId },
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('[atlas/workflow-runs POST]', err);
    return NextResponse.json({ error: 'Failed to create workflow run' }, { status: 500 });
  }
}
