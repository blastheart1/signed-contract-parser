import { db } from '@/lib/db';
import { atlasWorkflowRuns, atlasWorkflowSteps, atlasIntegrationEvents } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';

export type AdvanceResult = 'advanced' | 'awaiting_manual' | 'all_done' | 'nothing_to_advance';

export async function advanceRun(runId: string): Promise<AdvanceResult> {
  const steps = await db
    .select()
    .from(atlasWorkflowSteps)
    .where(eq(atlasWorkflowSteps.runId, runId))
    .orderBy(asc(atlasWorkflowSteps.createdAt));

  const firstQueued = steps.find((s) => s.status === 'queued');

  if (!firstQueued) {
    const allDone = steps.length > 0 && steps.every((s) => s.status === 'done');
    return allDone ? 'all_done' : 'nothing_to_advance';
  }

  // Mark step active
  await db
    .update(atlasWorkflowSteps)
    .set({ status: 'active', startedAt: new Date() })
    .where(eq(atlasWorkflowSteps.id, firstQueued.id));

  if (firstQueued.isManual) {
    return 'awaiting_manual';
  }

  // Simulate async work
  await new Promise((resolve) => setTimeout(resolve, 200));

  const now = new Date();

  // Mark step done
  await db
    .update(atlasWorkflowSteps)
    .set({ status: 'done', completedAt: now })
    .where(eq(atlasWorkflowSteps.id, firstQueued.id));

  // Log integration event
  await db.insert(atlasIntegrationEvents).values({
    runId,
    stepId: firstQueued.id,
    provider: 'atlas',
    eventType: 'step_completed',
    status: 'ok',
    durationMs: 200,
  });

  // Check if all steps are now done
  const remaining = steps.filter((s) => s.id !== firstQueued.id && s.status !== 'done');
  if (remaining.length === 0) {
    await db
      .update(atlasWorkflowRuns)
      .set({ status: 'completed', completedAt: now })
      .where(eq(atlasWorkflowRuns.id, runId));
  }

  return 'advanced';
}
