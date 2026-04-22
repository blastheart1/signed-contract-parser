# Atlas Integration Adapters

This guide covers wiring up the three provider integrations for the Calimingo Atlas onboarding/offboarding platform.

Each integration lives under `lib/atlas/integrations/<provider>/`. The pattern is the same for all three:

- A **client** file that initialises the SDK/HTTP client using env vars
- An **adapter** file that exposes domain-level functions (not raw API calls)
- An **errors** file that maps provider errors to typed `IntegrationError` objects

The workflow engine calls adapters, not the raw clients. Adapters write to `atlas_integration_events` and `atlas_access_accounts` directly.

---

## Folder structure to create

```
lib/atlas/integrations/
├── types.ts                      ← shared IntegrationError, ProviderResult types
├── google/
│   ├── client.ts                 ← Google Admin SDK auth via service account
│   ├── adapter.ts                ← createUser, suspendUser, restoreUser, etc.
│   └── errors.ts                 ← map GaxiosError → IntegrationError
├── trello/
│   ├── client.ts                 ← Trello REST client (API key + token)
│   ├── adapter.ts                ← inviteMember, removeMember, addToBoard, etc.
│   └── errors.ts
└── trainual/
    ├── client.ts                 ← Trainual REST client (API key)
    ├── adapter.ts                ← inviteUser, assignPlan, deactivateUser, etc.
    └── errors.ts
```

---

## Shared types (`lib/atlas/integrations/types.ts`)

```ts
export type ProviderResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: IntegrationError };

export interface IntegrationError {
  provider: string;
  code: string;         // e.g. "USER_ALREADY_EXISTS", "RATE_LIMITED"
  message: string;
  retryable: boolean;
  httpStatus?: number;
}
```

Every adapter function returns `ProviderResult<T>`. The workflow engine checks `result.ok` — if `false` and `error.retryable === true`, it re-queues the step; otherwise it marks the step `failed` and writes the error to `atlas_workflow_steps.errorMessage`.

---

## 1. Google Workspace

### Environment variables

```bash
GOOGLE_ADMIN_CLIENT_EMAIL=atlas-provisioner@your-project.iam.gserviceaccount.com
GOOGLE_ADMIN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GOOGLE_ADMIN_SUBJECT=admin@calimingo.com   # super admin for domain-wide delegation
GOOGLE_WORKSPACE_DOMAIN=calimingo.com
```

### IAM setup (one-time)

1. In Google Cloud Console, create a service account named `atlas-provisioner`.
2. Enable **domain-wide delegation** on the service account.
3. In Google Admin (`admin.google.com`) → Security → API Controls → Domain-wide delegation, add the client ID with these OAuth scopes:
   - `https://www.googleapis.com/auth/admin.directory.user`
   - `https://www.googleapis.com/auth/admin.directory.group.member`
4. Download the JSON key file; copy `client_email` and `private_key` into env vars.
5. Enable the **Admin SDK API** in Google Cloud Console.

### Install the SDK

```bash
npm install googleapis
```

### `lib/atlas/integrations/google/client.ts`

```ts
import { google } from 'googleapis';

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_ADMIN_CLIENT_EMAIL!,
  key: process.env.GOOGLE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  scopes: [
    'https://www.googleapis.com/auth/admin.directory.user',
    'https://www.googleapis.com/auth/admin.directory.group.member',
  ],
  subject: process.env.GOOGLE_ADMIN_SUBJECT!,
});

export const adminDirectory = google.admin({ version: 'directory_v1', auth });
export const DOMAIN = process.env.GOOGLE_WORKSPACE_DOMAIN!;
```

### `lib/atlas/integrations/google/adapter.ts` — key functions

```ts
import { adminDirectory, DOMAIN } from './client';
import type { ProviderResult } from '../types';

export interface GoogleUser {
  id: string;
  primaryEmail: string;
  suspended: boolean;
}

// Idempotent: if user already exists, returns existing user as ok=true
export async function createUser(opts: {
  email: string;
  firstName: string;
  lastName: string;
  orgUnitPath?: string;
  tempPassword: string;
}): Promise<ProviderResult<GoogleUser>> {
  try {
    // Check for existing user first (idempotency)
    try {
      const existing = await adminDirectory.users.get({ userKey: opts.email });
      return { ok: true, data: mapUser(existing.data) };
    } catch {
      // 404 = doesn't exist, proceed to create
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
    return { ok: true, data: mapUser(res.data) };
  } catch (err) {
    return { ok: false, error: mapGoogleError(err) };
  }
}

export async function suspendUser(email: string): Promise<ProviderResult> {
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

export async function restoreUser(email: string): Promise<ProviderResult> {
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

export async function addToGroup(
  email: string,
  groupEmail: string
): Promise<ProviderResult> {
  try {
    await adminDirectory.members.insert({
      groupKey: groupEmail,
      requestBody: { email, role: 'MEMBER' },
    });
    return { ok: true, data: undefined };
  } catch (err: any) {
    // 409 = already a member — treat as success (idempotent)
    if (err?.code === 409) return { ok: true, data: undefined };
    return { ok: false, error: mapGoogleError(err) };
  }
}

function mapUser(u: any): GoogleUser {
  return { id: u.id, primaryEmail: u.primaryEmail, suspended: u.suspended };
}
```

### `lib/atlas/integrations/google/errors.ts`

```ts
import type { IntegrationError } from '../types';

export function mapGoogleError(err: unknown): IntegrationError {
  const e = err as any;
  const status: number = e?.code ?? e?.response?.status ?? 0;
  const message: string = e?.message ?? 'Unknown Google Workspace error';

  return {
    provider: 'google',
    code: status === 404 ? 'NOT_FOUND'
        : status === 409 ? 'ALREADY_EXISTS'
        : status === 429 ? 'RATE_LIMITED'
        : status >= 500  ? 'SERVER_ERROR'
        : 'UNKNOWN',
    message,
    retryable: status === 429 || status >= 500,
    httpStatus: status,
  };
}
```

---

## 2. Trello

### API limitations to know upfront

- Trello's REST API supports inviting members **to a board** (`POST /boards/{id}/members`) but **does not expose a workspace-level member invite** via the standard API — you can only add members to individual boards.
- Invite via email: `PUT /boards/{id}/members` with `{ email, type: 'normal' }` sends an invite email. The member appears as `deactivated` until they accept.
- For workspace (organization) membership, use `POST /organizations/{id}/members/{username}` — this requires the user to already have a Trello account.

**Recommended approach:** Add by email per board. Store `status = 'invited'` in `atlas_access_accounts` until the webhook confirms acceptance, or poll the board members list on re-sync.

### Environment variables

```bash
TRELLO_API_KEY=your_api_key          # from trello.com/app-key
TRELLO_API_TOKEN=your_token          # OAuth token with read/write scope
TRELLO_WORKSPACE_ID=your_org_id      # short name or ID of the Calimingo workspace
```

### Install

```bash
npm install trello  # lightweight REST wrapper, or use fetch directly
```

Or use plain `fetch` — Trello's REST API is simple enough:

### `lib/atlas/integrations/trello/client.ts`

```ts
const BASE = 'https://api.trello.com/1';
const KEY = process.env.TRELLO_API_KEY!;
const TOKEN = process.env.TRELLO_API_TOKEN!;

export async function trelloFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${BASE}${path}${sep}key=${KEY}&token=${TOKEN}`;
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(body || res.statusText) as any;
    err.httpStatus = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}
```

### `lib/atlas/integrations/trello/adapter.ts` — key functions

```ts
import { trelloFetch } from './client';
import type { ProviderResult } from '../types';

// Add member to a board by email (sends invite if not a Trello member yet)
export async function inviteMemberToBoard(
  boardId: string,
  email: string,
  type: 'normal' | 'admin' | 'observer' = 'normal'
): Promise<ProviderResult<{ memberId?: string; invited: boolean }>> {
  try {
    const res = await trelloFetch<any>(`/boards/${boardId}/members`, {
      method: 'PUT',
      body: JSON.stringify({ email, type }),
    });
    return {
      ok: true,
      data: {
        memberId: res.id,
        invited: !res.id, // no id = invite email sent to non-member
      },
    };
  } catch (err) {
    return { ok: false, error: mapTrelloError(err) };
  }
}

// Remove a member from a board
export async function removeMemberFromBoard(
  boardId: string,
  memberId: string
): Promise<ProviderResult> {
  try {
    await trelloFetch(`/boards/${boardId}/members/${memberId}`, {
      method: 'DELETE',
    });
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: mapTrelloError(err) };
  }
}

// List boards for a workspace so the workflow engine can resolve boardIds by name
export async function getWorkspaceBoards(
  workspaceId: string
): Promise<ProviderResult<Array<{ id: string; name: string }>>> {
  try {
    const boards = await trelloFetch<any[]>(
      `/organizations/${workspaceId}/boards`
    );
    return { ok: true, data: boards.map((b) => ({ id: b.id, name: b.name })) };
  } catch (err) {
    return { ok: false, error: mapTrelloError(err) };
  }
}
```

### `lib/atlas/integrations/trello/errors.ts`

```ts
import type { IntegrationError } from '../types';

export function mapTrelloError(err: unknown): IntegrationError {
  const e = err as any;
  const status: number = e?.httpStatus ?? 0;
  return {
    provider: 'trello',
    code: status === 404 ? 'NOT_FOUND'
        : status === 429 ? 'RATE_LIMITED'
        : status >= 500  ? 'SERVER_ERROR'
        : 'UNKNOWN',
    message: e?.message ?? 'Unknown Trello error',
    retryable: status === 429 || status >= 500,
    httpStatus: status,
  };
}
```

### Trello board-to-preset mapping

Store board IDs in an env var or `atlas_role_templates.entitlements` JSON. Example:

```ts
// In atlas_role_templates.entitlements for SVC_TECH_L1:
{
  gmail: true,
  trello: true,
  trello_boards: ["BOARD_ID_SERVICE_OPS_OC", "BOARD_ID_POOL_FIELD"],
  trainual: true
}
```

The workflow step reads `entitlements.trello_boards` and calls `inviteMemberToBoard` for each.

---

## 3. Trainual

### API limitations to know upfront

- Trainual's REST API (v1) supports user creation/invite and subject (module) assignments.
- Rate limiting: 60 requests/minute. Build in a 1-second retry delay with jitter.
- Plan/subject assignment requires the user to exist first — the workflow must create the user, wait for `201`, then assign plans.

### Environment variables

```bash
TRAINUAL_API_KEY=your_api_key     # from app.trainual.com/settings/integrations
TRAINUAL_ACCOUNT_ID=12345         # numeric account ID shown in Trainual settings
```

### `lib/atlas/integrations/trainual/client.ts`

```ts
const BASE = 'https://app.trainual.com/public/v1';

export async function trainualFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${process.env.TRAINUAL_API_KEY}:x`).toString('base64')}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(body || res.statusText) as any;
    err.httpStatus = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}
```

### `lib/atlas/integrations/trainual/adapter.ts` — key functions

```ts
import { trainualFetch } from './client';
import type { ProviderResult } from '../types';

export interface TrainualUser {
  id: number;
  email: string;
  status: 'active' | 'invited' | 'inactive';
}

// Create/invite a user. Idempotent: returns existing user if email already registered.
export async function inviteUser(opts: {
  email: string;
  firstName: string;
  lastName: string;
  role?: 'member' | 'manager' | 'admin';
}): Promise<ProviderResult<TrainualUser>> {
  try {
    const body = {
      user: {
        email: opts.email,
        first_name: opts.firstName,
        last_name: opts.lastName,
        role: opts.role ?? 'member',
      },
    };
    const res = await trainualFetch<any>('/users', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return { ok: true, data: mapUser(res.user ?? res) };
  } catch (err: any) {
    // 422 with "already taken" = user exists; attempt a lookup
    if (err?.httpStatus === 422) {
      const lookup = await findUserByEmail(opts.email);
      if (lookup.ok) return lookup;
    }
    return { ok: false, error: mapTrainualError(err) };
  }
}

export async function findUserByEmail(
  email: string
): Promise<ProviderResult<TrainualUser>> {
  try {
    const res = await trainualFetch<any>(`/users?email=${encodeURIComponent(email)}`);
    const user = (res.users ?? res.data)?.[0];
    if (!user) return { ok: false, error: { provider: 'trainual', code: 'NOT_FOUND', message: 'User not found', retryable: false } };
    return { ok: true, data: mapUser(user) };
  } catch (err) {
    return { ok: false, error: mapTrainualError(err) };
  }
}

// Assign training subjects/plans by their IDs (from role template)
export async function assignSubjects(
  userId: number,
  subjectIds: number[]
): Promise<ProviderResult<{ assigned: number[] }>> {
  const assigned: number[] = [];
  for (const subjectId of subjectIds) {
    try {
      await trainualFetch(`/users/${userId}/subjects/${subjectId}`, {
        method: 'POST',
      });
      assigned.push(subjectId);
    } catch (err: any) {
      // 422 = already assigned — treat as success
      if (err?.httpStatus !== 422) {
        return { ok: false, error: mapTrainualError(err) };
      }
      assigned.push(subjectId);
    }
  }
  return { ok: true, data: { assigned } };
}

// Deactivate a user on offboarding
export async function deactivateUser(userId: number): Promise<ProviderResult> {
  try {
    await trainualFetch(`/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ user: { active: false } }),
    });
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: mapTrainualError(err) };
  }
}

function mapUser(u: any): TrainualUser {
  return { id: u.id, email: u.email, status: u.status ?? 'invited' };
}
```

### `lib/atlas/integrations/trainual/errors.ts`

```ts
import type { IntegrationError } from '../types';

export function mapTrainualError(err: unknown): IntegrationError {
  const e = err as any;
  const status: number = e?.httpStatus ?? 0;
  return {
    provider: 'trainual',
    code: status === 404 ? 'NOT_FOUND'
        : status === 422 ? 'VALIDATION_ERROR'
        : status === 429 ? 'RATE_LIMITED'
        : status >= 500  ? 'SERVER_ERROR'
        : 'UNKNOWN',
    message: e?.message ?? 'Unknown Trainual error',
    retryable: status === 429 || status >= 500,
    httpStatus: status,
  };
}
```

### Trainual subject IDs per preset

Store subject IDs in `atlas_role_templates.entitlements`:

```ts
// SVC_TECH_L1 entitlements JSON:
{
  gmail: true,
  trello: true,
  trainual: true,
  trainual_subject_ids: [101, 102, 103, 115, 118]
}
```

---

## Wiring adapters into a workflow step

A step handler pattern for the workflow engine. Place step handlers at `lib/atlas/workflow/steps/`:

```ts
// lib/atlas/workflow/steps/google-create-user.ts
import { createUser } from '../../integrations/google/adapter';
import { db } from '../../db';
import { atlasAccessAccounts, atlasIntegrationEvents } from '../../db/schema';

export async function runGoogleCreateUser(opts: {
  runId: string;
  stepId: string;
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
}) {
  const tempPassword = generateTempPassword(); // implement per your security policy
  const result = await createUser({
    email: opts.email,
    firstName: opts.firstName,
    lastName: opts.lastName,
    tempPassword,
  });

  // Write integration event (always)
  await db.insert(atlasIntegrationEvents).values({
    runId: opts.runId,
    stepId: opts.stepId,
    provider: 'google',
    eventType: 'create_user',
    status: result.ok ? 'ok' : 'error',
    responsePayload: result.ok ? result.data : result.error,
    errorMessage: result.ok ? null : result.error.message,
  });

  if (!result.ok) return result;

  // Update access account
  await db
    .insert(atlasAccessAccounts)
    .values({
      employeeId: opts.employeeId,
      system: 'gmail',
      status: 'provisioned',
      externalId: result.data.id,
      provisionedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [atlasAccessAccounts.employeeId, atlasAccessAccounts.system],
      set: { status: 'provisioned', externalId: result.data.id, provisionedAt: new Date() },
    });

  return result;
}
```

---

## Retry strategy

The workflow engine should implement exponential backoff for retryable errors:

| Retry | Delay |
|---|---|
| 1st | 15 seconds |
| 2nd | 60 seconds |
| 3rd | 5 minutes |
| 4th+ | Manual review required |

Store retry count in `atlas_workflow_steps.retryCount`. After 3 retries with `retryable === true`, mark step as `blocked` and surface it in the Attention panel on the dashboard.

---

## Testing without hitting live APIs

Use `INTEGRATION_MODE=mock` in `.env.local` during development:

```ts
// lib/atlas/integrations/google/adapter.ts
if (process.env.INTEGRATION_MODE === 'mock') {
  return { ok: true, data: { id: 'mock-id', primaryEmail: email, suspended: false } };
}
```

Or create `__mocks__` versions of each adapter for Jest integration tests.

---

## Env var checklist

| Variable | Used by |
|---|---|
| `GOOGLE_ADMIN_CLIENT_EMAIL` | Google adapter |
| `GOOGLE_ADMIN_PRIVATE_KEY` | Google adapter |
| `GOOGLE_ADMIN_SUBJECT` | Google adapter |
| `GOOGLE_WORKSPACE_DOMAIN` | Google adapter |
| `TRELLO_API_KEY` | Trello adapter |
| `TRELLO_API_TOKEN` | Trello adapter |
| `TRELLO_WORKSPACE_ID` | Trello adapter |
| `TRAINUAL_API_KEY` | Trainual adapter |
| `TRAINUAL_ACCOUNT_ID` | Trainual adapter |
| `INTEGRATION_MODE` | All adapters (`mock` for local dev) |

Add all of these to `.env.local` (never commit) and to Vercel's Environment Variables dashboard for preview and production.
