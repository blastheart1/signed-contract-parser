import { db } from '@/lib/db';
import {
  atlasEmployees,
  atlasIntegrationEvents,
  atlasAccessAccounts,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { inviteUser } from '@/lib/atlas/integrations/trainual/adapter';
import type { ProviderResult } from '@/lib/atlas/integrations/types';

export async function runTrainualInvite(opts: {
  runId: string;
  stepId: string;
  employeeId: string;
}): Promise<ProviderResult<void>> {
  const { runId, stepId, employeeId } = opts;
  const startedAt = Date.now();

  try {
    const [employee] = await db
      .select({
        firstName: atlasEmployees.firstName,
        lastName: atlasEmployees.lastName,
        companyEmail: atlasEmployees.companyEmail,
      })
      .from(atlasEmployees)
      .where(eq(atlasEmployees.id, employeeId))
      .limit(1);

    if (!employee?.companyEmail) {
      return {
        ok: false,
        error: {
          provider: 'trainual',
          code: 'PRECONDITION_FAILED',
          message: 'companyEmail is null — run generate_email step first',
          retryable: false,
        },
      };
    }

    const result = await inviteUser({
      email: employee.companyEmail,
      firstName: employee.firstName,
      lastName: employee.lastName,
    });

    const durationMs = Date.now() - startedAt;

    await db.insert(atlasIntegrationEvents).values({
      runId,
      stepId,
      provider: 'trainual',
      eventType: 'invite_user',
      status: result.ok ? 'ok' : 'error',
      httpStatus: result.ok ? 200 : (result.error.httpStatus ?? null),
      responsePayload: result.ok ? result.data : null,
      errorMessage: result.ok ? null : result.error.message,
      durationMs,
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    const now = new Date();
    const [existingAccount] = await db
      .select({ id: atlasAccessAccounts.id })
      .from(atlasAccessAccounts)
      .where(
        and(
          eq(atlasAccessAccounts.employeeId, employeeId),
          eq(atlasAccessAccounts.system, 'trainual'),
        ),
      )
      .limit(1);

    const externalId = String(result.data.id);

    if (existingAccount) {
      await db
        .update(atlasAccessAccounts)
        .set({ status: 'invited', externalId, updatedAt: now })
        .where(eq(atlasAccessAccounts.id, existingAccount.id));
    } else {
      await db.insert(atlasAccessAccounts).values({
        employeeId,
        system: 'trainual',
        status: 'invited',
        externalId,
      });
    }

    return { ok: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.insert(atlasIntegrationEvents).values({
      runId,
      stepId,
      provider: 'trainual',
      eventType: 'invite_user',
      status: 'error',
      errorMessage: message,
      durationMs: Date.now() - startedAt,
    });
    return {
      ok: false,
      error: { provider: 'trainual', code: 'UNKNOWN', message, retryable: true },
    };
  }
}
