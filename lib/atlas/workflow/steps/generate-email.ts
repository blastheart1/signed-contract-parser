import { db } from '@/lib/db';
import { atlasEmployees, atlasIntegrationEvents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { DOMAIN } from '@/lib/atlas/integrations/google/adapter';
import type { ProviderResult } from '@/lib/atlas/integrations/types';

export async function runGenerateEmail(opts: {
  runId: string;
  stepId: string;
  employeeId: string;
}): Promise<ProviderResult<{ email: string }>> {
  const { runId, stepId, employeeId } = opts;

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
          provider: 'atlas',
          code: 'NOT_FOUND',
          message: `Employee not found: ${employeeId}`,
          retryable: false,
        },
      };
    }

    // Derive email: firstName.lastName@domain (lowercase, sanitised)
    const local =
      employee.companyEmail?.split('@')[0] ??
      `${employee.firstName}.${employee.lastName}`.toLowerCase().replace(/\s+/g, '.');

    const domain = DOMAIN || process.env.GOOGLE_WORKSPACE_DOMAIN || 'calimingo.com';
    const email = `${local}@${domain}`;

    await db
      .update(atlasEmployees)
      .set({ companyEmail: email, updatedAt: new Date() })
      .where(eq(atlasEmployees.id, employeeId));

    await db.insert(atlasIntegrationEvents).values({
      runId,
      stepId,
      provider: 'atlas',
      eventType: 'generate_email',
      status: 'ok',
      responsePayload: { email },
    });

    return { ok: true, data: { email } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.insert(atlasIntegrationEvents).values({
      runId,
      stepId,
      provider: 'atlas',
      eventType: 'generate_email',
      status: 'error',
      errorMessage: message,
    });
    return {
      ok: false,
      error: {
        provider: 'atlas',
        code: 'DB_ERROR',
        message,
        retryable: true,
      },
    };
  }
}
