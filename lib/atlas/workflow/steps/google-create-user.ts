import { db } from '@/lib/db';
import {
  atlasEmployees,
  atlasIntegrationEvents,
  atlasAccessAccounts,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { createUser } from '@/lib/atlas/integrations/google/adapter';
import { generateTempPassword } from '@/lib/atlas/integrations/password';
import type { ProviderResult } from '@/lib/atlas/integrations/types';

export async function runGoogleCreateUser(opts: {
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

    if (!employee) {
      return {
        ok: false,
        error: {
          provider: 'google',
          code: 'NOT_FOUND',
          message: `Employee not found: ${employeeId}`,
          retryable: false,
        },
      };
    }

    if (!employee.companyEmail) {
      return {
        ok: false,
        error: {
          provider: 'google',
          code: 'PRECONDITION_FAILED',
          message: 'companyEmail is null — run generate_email step first',
          retryable: false,
        },
      };
    }

    const result = await createUser({
      email: employee.companyEmail,
      firstName: employee.firstName,
      lastName: employee.lastName,
      tempPassword: generateTempPassword(),
    });

    const durationMs = Date.now() - startedAt;

    await db.insert(atlasIntegrationEvents).values({
      runId,
      stepId,
      provider: 'google',
      eventType: 'create_user',
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
          eq(atlasAccessAccounts.system, 'gmail'),
        ),
      )
      .limit(1);

    if (existingAccount) {
      await db
        .update(atlasAccessAccounts)
        .set({
          status: 'provisioned',
          externalId: result.data.id,
          provisionedAt: now,
          updatedAt: now,
        })
        .where(eq(atlasAccessAccounts.id, existingAccount.id));
    } else {
      await db.insert(atlasAccessAccounts).values({
        employeeId,
        system: 'gmail',
        status: 'provisioned',
        externalId: result.data.id,
        provisionedAt: now,
      });
    }

    return { ok: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.insert(atlasIntegrationEvents).values({
      runId,
      stepId,
      provider: 'google',
      eventType: 'create_user',
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
