import { db } from '@/lib/db';
import {
  atlasEmployees,
  atlasIntegrationEvents,
  atlasAccessAccounts,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { suspendUser } from '@/lib/atlas/integrations/google/adapter';
import type { ProviderResult } from '@/lib/atlas/integrations/types';

export async function runRevokeGoogle(opts: {
  runId: string;
  stepId: string;
  employeeId: string;
}): Promise<ProviderResult<void>> {
  const { runId, stepId, employeeId } = opts;
  const startedAt = Date.now();

  try {
    const [employee] = await db
      .select({ companyEmail: atlasEmployees.companyEmail })
      .from(atlasEmployees)
      .where(eq(atlasEmployees.id, employeeId))
      .limit(1);

    if (!employee?.companyEmail) {
      return {
        ok: false,
        error: {
          provider: 'google',
          code: 'PRECONDITION_FAILED',
          message: 'companyEmail is null — cannot revoke a non-existent account',
          retryable: false,
        },
      };
    }

    const result = await suspendUser(employee.companyEmail);
    const durationMs = Date.now() - startedAt;

    await db.insert(atlasIntegrationEvents).values({
      runId,
      stepId,
      provider: 'google',
      eventType: 'suspend_user',
      status: result.ok ? 'ok' : 'error',
      httpStatus: result.ok ? 200 : (result.error.httpStatus ?? null),
      requestPayload: { email: employee.companyEmail },
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
          eq(atlasAccessAccounts.system, 'gmail'),
        ),
      )
      .limit(1);

    if (existingAccount) {
      await db
        .update(atlasAccessAccounts)
        .set({ status: 'revoked', revokedAt: now, updatedAt: now })
        .where(eq(atlasAccessAccounts.id, existingAccount.id));
    }

    return { ok: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.insert(atlasIntegrationEvents).values({
      runId,
      stepId,
      provider: 'google',
      eventType: 'suspend_user',
      status: 'error',
      errorMessage: message,
      durationMs: Date.now() - startedAt,
    });
    return {
      ok: false,
      error: { provider: 'google', code: 'UNKNOWN', message, retryable: true },
    };
  }
}
