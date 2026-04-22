import type { ProviderResult } from '../types';
import { adminDirectory, DOMAIN } from './client';
import { mapGoogleError } from './errors';

export interface GoogleUser {
  id: string;
  primaryEmail: string;
  suspended: boolean;
}

const isMock = () => process.env.INTEGRATION_MODE === 'mock';

// ─── createUser ───────────────────────────────────────────────────────────────

export async function createUser(opts: {
  email: string;
  firstName: string;
  lastName: string;
  orgUnitPath?: string;
  tempPassword: string;
}): Promise<ProviderResult<GoogleUser>> {
  if (isMock()) {
    console.warn(`[atlas/google mock] createUser → ${opts.email}`);
    return {
      ok: true,
      data: { id: 'mock-google-id', primaryEmail: opts.email, suspended: false },
    };
  }

  try {
    // Idempotency: check if user already exists
    try {
      const existing = await adminDirectory.users.get({
        userKey: opts.email,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- googleapis response shape is typed as any
      const u = existing.data as any;
      return {
        ok: true,
        data: {
          id: u.id ?? '',
          primaryEmail: u.primaryEmail ?? opts.email,
          suspended: u.suspended ?? false,
        },
      };
    } catch (lookupErr) {
      const e = lookupErr as Record<string, unknown>;
      const status = (
        e?.code ?? (e?.response as Record<string, unknown>)?.status ?? 0
      ) as number;
      // 404 = user does not exist → proceed to create
      if (status !== 404) {
        return { ok: false, error: mapGoogleError(lookupErr) };
      }
    }

    const res = await adminDirectory.users.insert({
      requestBody: {
        primaryEmail: opts.email,
        name: { givenName: opts.firstName, familyName: opts.lastName },
        password: opts.tempPassword,
        changePasswordAtNextLogin: true,
        orgUnitPath: opts.orgUnitPath ?? '/',
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- googleapis response shape
    const u = res.data as any;
    return {
      ok: true,
      data: {
        id: u.id ?? '',
        primaryEmail: u.primaryEmail ?? opts.email,
        suspended: u.suspended ?? false,
      },
    };
  } catch (err) {
    return { ok: false, error: mapGoogleError(err) };
  }
}

// ─── suspendUser ──────────────────────────────────────────────────────────────

export async function suspendUser(email: string): Promise<ProviderResult<void>> {
  if (isMock()) {
    console.warn(`[atlas/google mock] suspendUser → ${email}`);
    return { ok: true, data: undefined };
  }

  try {
    await adminDirectory.users.update({
      userKey: email,
      requestBody: { suspended: true },
    });
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: mapGoogleError(err) };
  }
}

// ─── restoreUser ──────────────────────────────────────────────────────────────

export async function restoreUser(email: string): Promise<ProviderResult<void>> {
  if (isMock()) {
    console.warn(`[atlas/google mock] restoreUser → ${email}`);
    return { ok: true, data: undefined };
  }

  try {
    await adminDirectory.users.update({
      userKey: email,
      requestBody: { suspended: false },
    });
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: mapGoogleError(err) };
  }
}

// ─── addToGroup ───────────────────────────────────────────────────────────────

export async function addToGroup(
  email: string,
  groupEmail: string,
): Promise<ProviderResult<void>> {
  if (isMock()) {
    console.warn(`[atlas/google mock] addToGroup → ${email} → ${groupEmail}`);
    return { ok: true, data: undefined };
  }

  try {
    await adminDirectory.members.insert({
      groupKey: groupEmail,
      requestBody: { email, role: 'MEMBER' },
    });
    return { ok: true, data: undefined };
  } catch (err) {
    // 409 = already a member — treat as success (idempotent)
    const e = err as Record<string, unknown>;
    const status = (
      e?.code ?? (e?.response as Record<string, unknown>)?.status ?? 0
    ) as number;
    if (status === 409) return { ok: true, data: undefined };
    return { ok: false, error: mapGoogleError(err) };
  }
}

export { DOMAIN };
