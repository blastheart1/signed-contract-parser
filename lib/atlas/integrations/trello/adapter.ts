import type { ProviderResult } from '../types';
import { trelloFetch } from './client';
import { mapTrelloError } from './errors';

const isMock = () => process.env.INTEGRATION_MODE === 'mock';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrelloBoard {
  id: string;
  name: string;
}

interface TrelloMemberResponse {
  id?: string;
}

// ─── inviteMemberToBoard ──────────────────────────────────────────────────────

export async function inviteMemberToBoard(
  boardId: string,
  email: string,
  type: 'normal' | 'admin' | 'observer' = 'normal',
): Promise<ProviderResult<{ memberId?: string; invited: boolean }>> {
  if (isMock()) {
    console.warn(`[atlas/trello mock] inviteMemberToBoard → board:${boardId} email:${email}`);
    return { ok: true, data: { memberId: 'mock-trello-member-id', invited: true } };
  }

  try {
    const res = await trelloFetch<TrelloMemberResponse>(
      `/boards/${boardId}/members`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type }),
      },
    );
    return { ok: true, data: { memberId: res.id, invited: true } };
  } catch (err) {
    return { ok: false, error: mapTrelloError(err) };
  }
}

// ─── removeMemberFromBoard ────────────────────────────────────────────────────

export async function removeMemberFromBoard(
  boardId: string,
  memberId: string,
): Promise<ProviderResult<void>> {
  if (isMock()) {
    console.warn(`[atlas/trello mock] removeMemberFromBoard → board:${boardId} member:${memberId}`);
    return { ok: true, data: undefined };
  }

  try {
    await trelloFetch<unknown>(
      `/boards/${boardId}/members/${memberId}`,
      { method: 'DELETE' },
    );
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: mapTrelloError(err) };
  }
}

// ─── getWorkspaceBoards ───────────────────────────────────────────────────────

export async function getWorkspaceBoards(
  workspaceId: string,
): Promise<ProviderResult<{ id: string; name: string }[]>> {
  if (isMock()) {
    console.warn(`[atlas/trello mock] getWorkspaceBoards → workspace:${workspaceId}`);
    return {
      ok: true,
      data: [{ id: 'mock-board-id', name: 'Mock Board' }],
    };
  }

  try {
    const boards = await trelloFetch<TrelloBoard[]>(
      `/organizations/${workspaceId}/boards?filter=open&fields=id,name`,
    );
    return {
      ok: true,
      data: boards.map((b) => ({ id: b.id, name: b.name })),
    };
  } catch (err) {
    return { ok: false, error: mapTrelloError(err) };
  }
}
