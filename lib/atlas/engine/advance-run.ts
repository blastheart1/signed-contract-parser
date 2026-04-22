import { db } from '@/lib/db';
import {
  atlasWorkflowRuns,
  atlasWorkflowSteps,
  atlasIntegrationEvents,
} from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import type { ProviderResult } from '@/lib/atlas/integrations/types';
import { runGenerateEmail } from '@/lib/atlas/workflow/steps/generate-email';
import { runGoogleCreateUser } from '@/lib/atlas/workflow/steps/google-create-user';
import { runTrelloInvite } from '@/lib/atlas/workflow/steps/trello-invite';
import { runTrainualInvite } from '@/lib/atlas/workflow/steps/trainual-invite';
import { runRevokeGoogle } from '@/lib/atlas/workflow/steps/revoke-google';

export type AdvanceResult = 'advanced' | 'awaiting_manual' | 'all_done' | 'nothing_to_advance';

interface StepHandlerOpts {
  runId: string;
  stepId: string;
  employeeId: string;
}

type StepHandler = (opts: StepHandlerOpts) => Promise<ProviderResult<unknown>>;

const STEP_HANDLERS: Record<string, StepHandler> = {
  generate_email: (o) => runGenerateEmail(o),
  google_create_user: (o) => runGoogleCreateUser(o),
  trello_invite: (o) => runTrelloInvite(o),
  trainual_invite: (o) => runTrainualInvite(o),
  revoke_google: (o) => runRevokeGoogle(o),
};

const MAX_RETRIES = 3;

export async function advanceRun(runId: string): Promise<AdvanceResult> {
  // Fetch run to get employeeId
  const [run] = await db
    .select({ employeeId: atlasWorkflowRuns.employeeId })
    .from(atlasWorkflowRuns)
    .where(eq(atlasWorkflowRuns.id, runId))
    .limit(1);

  if (!run) return 'nothing_to_advance';

  const steps = await db
    .select()
    .from(atlasWorkflowSteps)
    .where(eq(atlasWorkflowSteps.runId, runId))
    .orderBy(asc(atlasWorkflowSteps.createdAt));

  const firstQueued = steps.find((s) => s.status === 'queued');

  if (!firstQueued) {
    const allDone = steps.length > 0 && steps.every((s) => s.status === 'done' || s.status === 'skipped');
    return allDone ? 'all_done' : 'nothing_to_advance';
  }

  // Mark step active
  await db
    .update(atlasWorkflowSteps)
    .set({ status: 'active', startedAt: new Date() })
    .where(eq(atlasWorkflowSteps.id, firstQueued.id));

  // Manual steps pause the engine — wait for human action
  if (firstQueued.isManual) {
    return 'awaiting_manual';
  }

  const stepKey = firstQueued.stepKey;
  const handler = STEP_HANDLERS[stepKey];

  if (!handler) {
    // Unknown automated step — log as noop and mark done
    await db.insert(atlasIntegrationEvents).values({
      runId,
      stepId: firstQueued.id,
      provider: 'atlas',
      eventType: 'noop',
      status: 'ok',
    });

    const now = new Date();
    await db
      .update(atlasWorkflowSteps)
      .set({ status: 'done', completedAt: now })
      .where(eq(atlasWorkflowSteps.id, firstQueued.id));

    await maybeCompleteRun(runId, firstQueued.id, steps, now);
    return 'advanced';
  }

  const result = await handler({
    runId,
    stepId: firstQueued.id,
    employeeId: run.employeeId,
  });

  const now = new Date();

  if (result.ok) {
    await db
      .update(atlasWorkflowSteps)
      .set({ status: 'done', completedAt: now, errorMessage: null })
      .where(eq(atlasWorkflowSteps.id, firstQueued.id));

    await maybeCompleteRun(runId, firstQueued.id, steps, now);
    return 'advanced';
  }

  // Failure path
  const error = result.error;
  const newRetryCount = (firstQueued.retryCount ?? 0) + 1;

  if (error.retryable && newRetryCount < MAX_RETRIES) {
    // Return to queue for retry on next advance call
    await db
      .update(atlasWorkflowSteps)
      .set({
        status: 'queued',
        retryCount: newRetryCount,
        errorMessage: error.message,
        startedAt: null,
      })
      .where(eq(atlasWorkflowSteps.id, firstQueued.id));
  } else if (error.retryable && newRetryCount >= MAX_RETRIES) {
    // Exhausted retries
    await db
      .update(atlasWorkflowSteps)
      .set({
        status: 'blocked',
        retryCount: newRetryCount,
        errorMessage: error.message,
      })
      .where(eq(atlasWorkflowSteps.id, firstQueued.id));

    await db
      .update(atlasWorkflowRuns)
      .set({ status: 'blocked', updatedAt: now })
      .where(eq(atlasWorkflowRuns.id, runId));
  } else {
    // Non-retryable failure
    await db
      .update(atlasWorkflowSteps)
      .set({
        status: 'failed',
        retryCount: newRetryCount,
        errorMessage: error.message,
        completedAt: now,
      })
      .where(eq(atlasWorkflowSteps.id, firstQueued.id));

    await db
      .update(atlasWorkflowRuns)
      .set({ status: 'failed', updatedAt: now })
      .where(eq(atlasWorkflowRuns.id, runId));
  }

  return 'advanced';
}

async function maybeCompleteRun(
  runId: string,
  completedStepId: string,
  allSteps: { id: string; status: string }[],
  now: Date,
): Promise<void> {
  const remaining = allSteps.filter(
    (s) => s.id !== completedStepId && s.status !== 'done' && s.status !== 'skipped',
  );
  if (remaining.length === 0) {
    await db
      .update(atlasWorkflowRuns)
      .set({ status: 'completed', completedAt: now, updatedAt: now })
      .where(eq(atlasWorkflowRuns.id, runId));
  }
}
