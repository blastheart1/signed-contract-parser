import { db } from '@/lib/db';
import {
  atlasEmployees,
  atlasIntegrationEvents,
  atlasAccessAccounts,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  getWorkspaceBoards,
  inviteMemberToBoard,
} from '@/lib/atlas/integrations/trello/adapter';
import type { ProviderResult } from '@/lib/atlas/integrations/types';

export async function runTrelloInvite(opts: {
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
          provider: 'trello',
          code: 'PRECONDITION_FAILED',
          message: 'companyEmail is null — run generate_email step first',
          retryable: false,
        },
      };
    }

    const workspaceId = process.env.TRELLO_WORKSPACE_ID ?? '';
    if (!workspaceId) {
      console.warn('[atlas/trello] TRELLO_WORKSPACE_ID not set');
    }

    const boardsResult = await getWorkspaceBoards(workspaceId);
    if (!boardsResult.ok) {
      await db.insert(atlasIntegrationEvents).values({
        runId,
        stepId,
        provider: 'trello',
        eventType: 'get_workspace_boards',
        status: 'error',
        errorMessage: boardsResult.error.message,
        durationMs: Date.now() - startedAt,
      });
      return { ok: false, error: boardsResult.error };
    }

    const email = employee.companyEmail;
    let anySuccess = false;

    for (const board of boardsResult.data) {
      const inviteResult = await inviteMemberToBoard(board.id, email);

      await db.insert(atlasIntegrationEvents).values({
        runId,
        stepId,
        provider: 'trello',
        eventType: 'invite_member',
        status: inviteResult.ok ? 'ok' : 'error',
        requestPayload: { boardId: board.id, boardName: board.name, email },
        responsePayload: inviteResult.ok ? inviteResult.data : null,
        errorMessage: inviteResult.ok ? null : inviteResult.error.message,
        durationMs: Date.now() - startedAt,
      });

      if (inviteResult.ok) anySuccess = true;
    }

    if (!anySuccess && boardsResult.data.length > 0) {
      return {
        ok: false,
        error: {
          provider: 'trello',
          code: 'ALL_INVITES_FAILED',
          message: 'Failed to invite member to any Trello board',
          retryable: true,
        },
      };
    }

    const now = new Date();
    const [existingAccount] = await db
      .select({ id: atlasAccessAccounts.id })
      .from(atlasAccessAccounts)
      .where(
        and(
          eq(atlasAccessAccounts.employeeId, employeeId),
          eq(atlasAccessAccounts.system, 'trello'),
        ),
      )
      .limit(1);

    if (existingAccount) {
      await db
        .update(atlasAccessAccounts)
        .set({ status: 'invited', updatedAt: now })
        .where(eq(atlasAccessAccounts.id, existingAccount.id));
    } else {
      await db.insert(atlasAccessAccounts).values({
        employeeId,
        system: 'trello',
        status: 'invited',
      });
    }

    return { ok: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.insert(atlasIntegrationEvents).values({
      runId,
      stepId,
      provider: 'trello',
      eventType: 'invite_member',
      status: 'error',
      errorMessage: message,
      durationMs: Date.now() - startedAt,
    });
    return {
      ok: false,
      error: { provider: 'trello', code: 'UNKNOWN', message, retryable: true },
    };
  }
}
