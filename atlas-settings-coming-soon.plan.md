# Atlas Settings — "Coming Soon" Stubs Implementation Plan

## Overview

Three buttons in `app/atlas/settings/page.tsx` currently fire `toast.info('... coming soon')`. This plan replaces all three with fully persisted, auditable CRUD flows.

| Location | Button | Current Stub |
|----------|--------|--------------|
| Settings → Orientation (tab 1) | "Edit" per invite row | `toast.info('Template editor coming soon')` |
| Settings → Integrations (tab 2) | "Configure" per integration | `toast.info('Integration configuration coming soon')` |
| Settings → Permissions (tab 4) | "Edit" per role row | `toast.info('Template editor coming soon')` ← copy-paste bug, wrong label |

---

## Shared Utilities — Build First

| Utility | File | Used by |
|---------|------|---------|
| `encryptSecret` / `decryptSecret` / `maskSecret` | `lib/atlas/secrets.ts` | Feature 2 (API keys), refactors `crypto.ts` |
| `ConfirmButton` (two-state, resets on blur/3s timeout) | `components/atlas/ConfirmButton.tsx` | Features 1, 2, 3 (destructive actions) |
| `InlineEditRow` component | `components/atlas/InlineEditRow.tsx` | Extract after Feature 1, reuse in Feature 3 |
| `saveWithToast` helper | `lib/atlas/client-utils.ts` | All three features |

---

## Feature 1 — Orientation Template Editor

**Priority: P1 · Effort: M**

### DB — New table `atlas_orientation_events`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid, pk, defaultRandom | |
| `title` | varchar(255), not null | "Day-1 Orientation" |
| `attendees` | varchar(255), not null | "All new hires" |
| `dayLabel` | varchar(50), not null | "Day 1", "Day 2", "Day 30" |
| `timeLabel` | varchar(50) | "9:00 AM", nullable for all-day |
| `sortOrder` | integer, not null, default 0 | ordering |
| `isActive` | boolean, not null, default true | soft delete flag |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

Seed from the 5 hardcoded `ORIENTATION_INVITES` rows.
Index: `atlas_orientation_events_sort_idx` on `sortOrder`.

### API Routes

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/atlas/orientation-events` | List ordered by `sortOrder`, `isActive = true` |
| POST | `/api/atlas/orientation-events` | Create; body `{ title, attendees, dayLabel, timeLabel? }` |
| PATCH | `/api/atlas/orientation-events/[id]` | Partial update; audit `orientation_event.update` |
| DELETE | `/api/atlas/orientation-events/[id]` | Soft delete (`isActive = false`); audit `orientation_event.delete` |

All routes require `requireAtlasAuth()`.

### UI Changes

- Remove hardcoded `ORIENTATION_INVITES` array.
- On tab mount, fetch `/api/atlas/orientation-events`.
- Per-row: "Edit" toggles `editingId` state → fields become inline inputs (title, attendees, dayLabel, timeLabel) → Save / Cancel buttons.
- "Add invite" button in PanelHeader (mirrors "New preset" pattern).
- Trash icon per row with `ConfirmButton` (confirm-on-second-click).
- `toast.success('Invite updated')` / `toast.error(...)` on API response.

### Files Affected

- `lib/db/schema.ts` — add table + type exports
- `lib/atlas/queries.ts` — `listOrientationEvents`, `createOrientationEvent`, `updateOrientationEvent`, `deleteOrientationEvent`
- `lib/atlas/schemas.ts` — `OrientationEventCreateSchema`, `OrientationEventUpdateSchema`
- `app/api/atlas/orientation-events/route.ts` — GET / POST
- `app/api/atlas/orientation-events/[id]/route.ts` — PATCH / DELETE
- `app/atlas/settings/page.tsx` — replace hardcoded array + stub with live editor
- `scripts/seed-atlas-orientation.ts` — optional seed script (or embed in migration)

---

## Feature 2 — Integration Configuration Panel

**Priority: P1 · Effort: L**

### DB — New table `atlas_integrations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid, pk, defaultRandom | |
| `provider` | varchar(50), not null, unique | `google_workspace`, `dropbox`, `trello`, `billcom`, `quickbooks`, `trainual`, `fleet` |
| `displayName` | varchar(255), not null | "Google Workspace" |
| `ownerLabel` | varchar(100) | "IT Team" |
| `status` | varchar(30), not null, default `'disconnected'` | `connected` / `error` / `disconnected` / `pending` |
| `apiKeyEncrypted` | text | AES-GCM ciphertext; **never exposed** |
| `apiKeyLast4` | varchar(8) | UI masking only |
| `webhookUrl` | varchar(500) | |
| `config` | jsonb | Provider-specific extras |
| `lastSyncAt` | timestamp | |
| `lastErrorMessage` | text | |
| `isEnabled` | boolean, not null, default true | |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

Seed from the 7 hardcoded `INTEGRATIONS` rows.
Indexes: `provider`, `status`.

### API Routes

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/atlas/integrations` | Returns rows with `apiKeyLast4` only — **no ciphertext ever** |
| PATCH | `/api/atlas/integrations/[id]` | Update apiKey (encrypt + store last4), webhookUrl, isEnabled |
| POST | `/api/atlas/integrations/[id]/test` | Phase 1: stub; phase 2: real provider smoke test |
| POST | `/api/atlas/integrations/[id]/disconnect` | Clear `apiKeyEncrypted`, set `status = 'disconnected'` |

All routes require `requireAtlasAuth({ requiredRoles: ['admin'] })`.
Audit: every mutation logs field names, **never key values**.

### UI Changes

- Remove hardcoded `INTEGRATIONS` array. Fetch from `/api/atlas/integrations` on tab mount.
- "Configure" toggles `expandedIntegrationId` → inline panel below the row:
  - **API key field**: shows `"•••{apiKeyLast4}"`, read-only until "Replace" clicked → empty input for new key → Save / Cancel.
  - **Webhook URL**: standard text input.
  - **Enable toggle**: reuse existing switch pattern from "New preset" modal.
  - **"Test connection"**: fires `POST /test`, inline green/red dot + toast result.
  - **"Disconnect"**: red destructive `ConfirmButton`, clears key.
- Status `Pill` reads live from DB, not hardcoded.

### Files Affected

- `lib/db/schema.ts` — add table + type exports
- `lib/atlas/secrets.ts` — **new**: `encryptSecret`, `decryptSecret`, `maskSecret`
- `lib/atlas/crypto.ts` — refactor to call `secrets.ts` (keep public API stable)
- `lib/atlas/queries.ts` — `listIntegrations`, `updateIntegration`, `testIntegration`, `disconnectIntegration`
- `lib/atlas/schemas.ts` — `IntegrationUpdateSchema`
- `app/api/atlas/integrations/route.ts` — GET
- `app/api/atlas/integrations/[id]/route.ts` — PATCH
- `app/api/atlas/integrations/[id]/test/route.ts` — POST
- `app/api/atlas/integrations/[id]/disconnect/route.ts` — POST
- `app/atlas/settings/page.tsx` — integration panel
- `.env.example` — add `ATLAS_SECRETS_KEY`

---

## Feature 3 — Permissions Role Editor

**Priority: P1 · Effort: L**

### Critical Schema Issue

Current code filters `users.role` (enum: `admin/contract_manager/sales_rep/accountant/viewer/vendor`) by string-matching against labels "HR/IT/Admin/Manager/Finance". **This never matches** — no members ever show. Feature 3 fixes this with a proper join table.

### DB — Two new tables

**`atlas_user_roles`** — user ↔ Atlas role assignments:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid, pk | |
| `userId` | uuid, not null, fk `users.id` on delete cascade | |
| `atlasRole` | `atlas_role` enum (existing) | `hr_admin` / `it_admin` / `ops_admin` / `finance` / `manager` / `viewer` |
| `assignedAt` | timestamp, not null, default now | |
| `assignedBy` | uuid, fk `users.id` | |

Unique constraint: `(userId, atlasRole)`. Index on `atlasRole`.

**`atlas_role_scopes`** — editable scope descriptions per role:

| Column | Type | Notes |
|--------|------|-------|
| `atlasRole` | `atlas_role` enum, pk | One row per role |
| `scopeDescription` | text, not null | |
| `updatedAt` | timestamp | |
| `updatedBy` | uuid, fk `users.id` | |

Seed: 6 rows mapped from hardcoded `PERMISSIONS` labels:
`HR → hr_admin`, `IT → it_admin`, `Admin → ops_admin`, `Manager → manager`, `Finance → finance`, `viewer` row for completeness.

### API Routes

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/atlas/permissions` | Roles with member lists + scope descriptions |
| GET | `/api/atlas/permissions/available-users?role=X` | Users NOT currently in that role |
| POST | `/api/atlas/permissions/[role]/members` | Add user; body `{ userId }` |
| DELETE | `/api/atlas/permissions/[role]/members/[userId]` | Remove user |
| PATCH | `/api/atlas/permissions/[role]/scope` | Update scope description |

All routes require `requireAtlasAuth({ requiredRoles: ['admin'] })`.
Audit: `permission.member_add`, `permission.member_remove`, `permission.scope_update`.

### UI Changes

- Replace broken `users.role` string-match approach with `/api/atlas/permissions` fetch.
- Fix wrong toast label (`'Template editor coming soon'` → removed entirely).
- "Edit" toggles `expandedRole` state → inline panel per row:
  - Member chips get `×` remove button (hover reveal) → `ConfirmButton` on second click.
  - Scope description: `<input>` + Save button → PATCH.
  - Add member: search-filterable `<select>` from `/api/atlas/permissions/available-users?role=X` → POST.
- Use existing `Avatar` component for member chips.

### Files Affected

- `lib/db/schema.ts` — `atlasUserRoles`, `atlasRoleScopes` tables + type exports
- `lib/atlas/queries.ts` — `listPermissions`, `listAvailableUsersForRole`, `addRoleMember`, `removeRoleMember`, `updateRoleScope`
- `lib/atlas/schemas.ts` — `RoleMemberSchema`, `RoleScopeSchema`
- `app/api/atlas/permissions/route.ts` — GET
- `app/api/atlas/permissions/available-users/route.ts` — GET
- `app/api/atlas/permissions/[role]/members/route.ts` — POST
- `app/api/atlas/permissions/[role]/members/[userId]/route.ts` — DELETE
- `app/api/atlas/permissions/[role]/scope/route.ts` — PATCH
- `app/atlas/settings/page.tsx` — permissions editor

---

## Recommended Implementation Order

```
Step 1  Shared utilities                              [S]
        lib/atlas/secrets.ts
        lib/atlas/client-utils.ts (saveWithToast)
        components/atlas/ConfirmButton.tsx

Step 2  Feature 1 — Orientation Template Editor      [M]
        Validates the full DB → API → inline-edit flow cheaply.
        Reference implementation for Features 2 & 3.

Step 3  Extract InlineEditRow component              [S]
        From Feature 1 once stable → reuse in Feature 3.

Step 4  Feature 3 — Permissions Role Editor          [L]
        Fixes broken schema. Sets role model used to gate Feature 2.

Step 5  Feature 2 — Integration Configuration Panel [L]
        Benefits from correct role gating.
        Encryption + masked key + provider test stubs.
```

Each feature is independently mergeable behind its own PR.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| API key leakage in audit logs or responses | `logAudit` logs field names only, never values. GET `/integrations` strips ciphertext entirely. |
| Missing `ATLAS_SECRETS_KEY` in production | Throw at startup if `NODE_ENV === 'production'` and key is absent. Document in `.env.example`. |
| Permissions schema mismatch (current UI shows 0 members) | Feature 3 fixes with `atlas_user_roles` join table + proper seed. |
| Weak role gating (current guard only checks session) | All mutating endpoints use `requireAtlasAuth({ requiredRoles: ['admin'] })`. |
| "Test connection" SSRF via webhook URL | Phase 1 stub only. Phase 2: whitelist provider-specific hosts, never follow redirects. |
| Concurrent drag-reorder corrupting `sortOrder` | P2 stretch goal. When implemented: transactional bulk update with optimistic concurrency on `updatedAt`. |

---

## Success Criteria

- [ ] No `toast.info('... coming soon')` calls remain in `app/atlas/settings/page.tsx`
- [ ] All three features persist across page reloads
- [ ] Every mutation writes an audit log entry
- [ ] Integration API keys never appear in API responses, logs, or audit details
- [ ] Non-admin users receive 403 on any mutating endpoint
- [ ] `npm run build` passes before each PR is pushed

---

## Key File Paths

| File | Role |
|------|------|
| `app/atlas/settings/page.tsx` | Target UI — contains all three stubs |
| `lib/db/schema.ts` | New tables added at bottom of Atlas section |
| `lib/atlas/queries.ts` | All new query functions |
| `lib/atlas/schemas.ts` | All new Zod validators |
| `lib/atlas/secrets.ts` | New shared encryption utility |
| `lib/atlas/auth-guard.ts` | Auth pattern — use with `requiredRoles` |
| `lib/atlas/audit.ts` | Audit helper — reuse as-is |
| `lib/atlas/crypto.ts` | Refactor to call `secrets.ts` |
| `app/api/atlas/role-templates/route.ts` | Reference implementation pattern |
| `.env.example` | Add `ATLAS_SECRETS_KEY` |
