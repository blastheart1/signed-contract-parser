import type { ProviderResult } from '../types';
import { trainualFetch } from './client';
import { mapTrainualError } from './errors';

export interface TrainualUser {
  id: number;
  email: string;
  status: 'active' | 'invited' | 'inactive';
}

const isMock = () => process.env.INTEGRATION_MODE === 'mock';

// ─── Internal API response shapes ─────────────────────────────────────────────

interface TrainualUserResponse {
  id: number;
  email: string;
  status: string;
}

interface TrainualUsersListResponse {
  data: TrainualUserResponse[];
}

function toTrainualUser(u: TrainualUserResponse): TrainualUser {
  return {
    id: u.id,
    email: u.email,
    status: (u.status as TrainualUser['status']) ?? 'invited',
  };
}

// ─── findUserByEmail ──────────────────────────────────────────────────────────

export async function findUserByEmail(
  email: string,
): Promise<ProviderResult<TrainualUser>> {
  if (isMock()) {
    console.warn(`[atlas/trainual mock] findUserByEmail → ${email}`);
    return {
      ok: true,
      data: { id: 9999, email, status: 'invited' },
    };
  }

  try {
    const res = await trainualFetch<TrainualUsersListResponse>(
      `/users?filter[email]=${encodeURIComponent(email)}`,
    );
    const user = res.data[0];
    if (!user) {
      return {
        ok: false,
        error: {
          provider: 'trainual',
          code: 'NOT_FOUND',
          message: `No Trainual user found with email: ${email}`,
          retryable: false,
          httpStatus: 404,
        },
      };
    }
    return { ok: true, data: toTrainualUser(user) };
  } catch (err) {
    return { ok: false, error: mapTrainualError(err) };
  }
}

// ─── inviteUser ───────────────────────────────────────────────────────────────

export async function inviteUser(opts: {
  email: string;
  firstName: string;
  lastName: string;
  role?: string;
}): Promise<ProviderResult<TrainualUser>> {
  if (isMock()) {
    console.warn(`[atlas/trainual mock] inviteUser → ${opts.email}`);
    return {
      ok: true,
      data: { id: 9999, email: opts.email, status: 'invited' },
    };
  }

  try {
    const res = await trainualFetch<TrainualUserResponse>('/users', {
      method: 'POST',
      body: JSON.stringify({
        user: {
          email: opts.email,
          first_name: opts.firstName,
          last_name: opts.lastName,
          role: opts.role ?? 'member',
        },
      }),
    });
    return { ok: true, data: toTrainualUser(res) };
  } catch (err) {
    const e = err as Record<string, unknown>;
    const status = (e?.httpStatus ?? 0) as number;

    // 422 = user likely already exists; look them up instead (idempotent)
    if (status === 422) {
      return findUserByEmail(opts.email);
    }

    return { ok: false, error: mapTrainualError(err) };
  }
}

// ─── assignSubjects ───────────────────────────────────────────────────────────

export async function assignSubjects(
  userId: number,
  subjectIds: number[],
): Promise<ProviderResult<{ assigned: number[] }>> {
  if (isMock()) {
    console.warn(`[atlas/trainual mock] assignSubjects → user:${userId} subjects:${subjectIds.join(',')}`);
    return { ok: true, data: { assigned: subjectIds } };
  }

  const assigned: number[] = [];

  for (const subjectId of subjectIds) {
    try {
      await trainualFetch(`/users/${userId}/subjects/${subjectId}`, {
        method: 'POST',
      });
      assigned.push(subjectId);
    } catch (err) {
      const e = err as Record<string, unknown>;
      const status = (e?.httpStatus ?? 0) as number;
      // 422 = already assigned — treat as success
      if (status === 422) {
        assigned.push(subjectId);
      } else {
        console.error(
          `[atlas/trainual] Failed to assign subject ${subjectId} to user ${userId}: ${String(e?.message)}`,
        );
      }
    }
  }

  return { ok: true, data: { assigned } };
}

// ─── deactivateUser ───────────────────────────────────────────────────────────

export async function deactivateUser(userId: number): Promise<ProviderResult<void>> {
  if (isMock()) {
    console.warn(`[atlas/trainual mock] deactivateUser → user:${userId}`);
    return { ok: true, data: undefined };
  }

  try {
    await trainualFetch(`/users/${userId}/deactivate`, { method: 'POST' });
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: mapTrainualError(err) };
  }
}
