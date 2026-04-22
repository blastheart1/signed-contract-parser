---
name: order-approval-email-deeplink
overview: Add order approval email deep link, preview modal Send to/CC fields, and "Preview and Send Email" button; keep manual trigger and hardcoded webhook with existing rate limiting.
todos:
  - id: choose-base-url-and-link-pattern
    content: Choose env var for app base URL and the exact order approval link pattern (direct vs login+next).
    status: pending
  - id: compute-order-approval-link
    content: In buildOrderApprovalEmailPayload, compute a full order-approval link string from env + approvalId and pass it into renderOrderApprovalHtml.
    status: pending
  - id: render-link-in-email-template
    content: Hyperlink Reference No value and add "View Order Approval" button after table in email template (both use orderApprovalLink).
    status: pending
  - id: verify-auth-and-flow
    content: Verify that clicking the email link goes through existing login/auth and lands on the correct order approval, without bypassing authorization checks.
    status: pending
  - id: preview-modal-send-to-cc
    content: Add Send to/CC inputs; validate each token (comma/space split) as email; invalid = do not recognize input, user cannot proceed until all valid.
    status: pending
  - id: button-rename-and-icon
    content: Rename trigger and dialog button to "Preview and Send Email" and add Mail icon (lucide-react).
    status: pending
  - id: backend-forward-sendto-cc
    content: In test-send-webhook route, accept sendTo/cc from body and include in JSON payload to Zapier.
    status: pending
isProject: false
---

## Scope and constraints

- **Trigger**: Manual only (button on order approval detail page). No auto-send on stage change.
- **Webhook**: Continue using the existing hardcoded Zapier URL and 15s cooldown in [app/api/order-approvals/[id]/test-send-webhook/route.ts](app/api/order-approvals/[id]/test-send-webhook/route.ts). No new routes or rate-limit changes.

## Goal

1. Add a deep link in the order approval email so recipients can open the approval in the app (after login if needed).
2. Add **Send to** and **CC** fields in the preview modal (Send to prepopulated with vendor email; both comma/space-separated).
3. Rename the action to **"Preview and Send Email"** and add an email icon.

## High-level approach

- **Use configuration, not hardcoding**: Derive the base app URL from an environment variable (e.g. `NEXT_PUBLIC_APP_URL` or `APP_BASE_URL`), so links work across environments (local, staging, prod) without code changes.
- **Generate a minimal, deterministic URL**: In the email payload builder, construct a single deep-link string based on the existing `approvalId` (and optionally a `next`/`callbackUrl` pattern if your login flow supports redirects).
- **Pass the link into the existing HTML renderer**: Extend the `renderOrderApprovalHtml` data shape with `orderApprovalLink` (or similar), and render a small call-to-action section in the email template using a standard `<a>` tag.
- **Rely on existing auth + rate limiting**: Keep link generation side effect-free and cheap; continue using the existing cooldown on the test-send webhook.

## Files to touch

- **lib/order-approval-email.ts**
  - Extend `renderOrderApprovalHtml` input to include `orderApprovalLink`.
  - In `buildOrderApprovalEmailPayload`, read the base URL from env (with a safe default or guarded error) and construct a full URL (e.g. `${APP_BASE_URL}/dashboard/vendor-negotiation/${approvalId}` or login-redirect variant).
  - Pass this URL into `renderOrderApprovalHtml`.
  - In the HTML template: (1) make the **Reference No** value a hyperlink to the order approval URL; (2) add a **"View Order Approval"** button/link after the details table (same URL), styled as a CTA.
- **(Optional) Auth/login route** (only if not already supporting redirects): If the login page does not accept a `next`/`callbackUrl` parameter, add support so that after successful login users are redirected to that path.

## Preview modal: Send to and CC

- **File**: [app/dashboard/vendor-negotiation/[id]/page.tsx](app/dashboard/vendor-negotiation/[id]/page.tsx)
- **State**: Add `sendTo` and `cc` (strings). When opening the preview (`handleOpenEmailPreview`), set `sendTo` to `approval.vendorEmail ?? ''`; leave `cc` empty.
- **UI**: Inside the preview `AlertDialogContent`, above the iframe:
  - **Send to**: Label "Send to", input bound to `sendTo`. Helper text: "Separate multiple emails with comma or space."
  - **CC**: Label "CC", input bound to `cc`. Same comma/space separation.
- **Frontend validation (required)**:
  - Split `sendTo` and `cc` on commas and spaces, trim each part, filter out empty strings. Each resulting token must be a valid email format (e.g. regex). **If any token is not a valid email, do not recognize that input**—treat the field as invalid.
  - **User cannot proceed** while there is any invalid format: disable the send action (or show a clear inline error) until every token in Send to and CC is a valid email. Do not call the webhook until validation passes.
  - Send to must have at least one valid address (or fall back to `approval.vendorEmail` when Send to is empty). Only after all tokens are valid, include `sendTo` and `cc` in the POST body as comma-separated strings (minimal payload for Zapier). No backend parsing or validation; backend just forwards the strings.

## Button rename and icon

- **Trigger button** (card header): Label **"Preview and Send Email"**, add `Mail` icon from `lucide-react` (with or without keeping `FlaskConical`).
- **Dialog action button**: Label **"Preview and Send Email"** (or "Send Email"), same icon; loading state e.g. "Sending...".

## Backend: forward Send to / CC to Zapier

- **File**: [app/api/order-approvals/[id]/test-send-webhook/route.ts](app/api/order-approvals/[id]/test-send-webhook/route.ts)
- Read `sendTo` and `cc` from the request body (strings; frontend sends comma-separated after validation). No parsing or validation on the backend.
- Merge them into the JSON payload sent to the hardcoded webhook URL (additive; no change to rate limiting or auth).
- No extra DB or external calls.

## Security & performance considerations

- **No sensitive data in query string**: Keep the link path to just the approval id (UUID); do not embed secrets or PII in the URL.
- **Rely on existing authorization**: The order approval page and API already enforce roles and vendor access; the deep link only points to that page.
- **Minimal extra work**: Link construction and Send to/CC parsing are O(n) on short strings; no new DB or network.
- **Rate limiting**: Unchanged; same test-send endpoint and cooldown.
- **Config fail-safes**: If the base URL env var is missing, skip rendering the link or use a safe default for non-production.

## Implementation steps

**Deep link**

1. Decide the canonical base URL env var and link pattern (direct path vs. `/login?next=...`).
2. In lib/order-approval-email.ts, update `buildOrderApprovalEmailPayload` to compute `orderApprovalLink` and pass it into `renderOrderApprovalHtml`.
3. Extend `renderOrderApprovalHtml` to accept `orderApprovalLink`; hyperlink the Reference No value and add a "View Order Approval" button after the details table.
4. (Optional) If login does not support redirects, add `next`/`callbackUrl` support and redirect after auth.
5. Test link in preview flow and in a mail client.

**Preview modal and button**

1. Add `sendTo` and `cc` state; in `handleOpenEmailPreview` set `sendTo` from `approval.vendorEmail`.
2. Add Send to and CC inputs above the iframe in the preview dialog; helper text for comma/space.
3. Validate Send to and CC: split by comma and space, trim, filter empties; validate every token as email format. If any token is invalid, do not recognize the input—show error and block send (user cannot proceed until all entries are valid). Only then send comma-separated strings in POST body; default sendTo to vendor email if empty after parse.
4. Rename both buttons to "Preview and Send Email" and add `Mail` icon.
5. In test-send-webhook route, read sendTo/cc from body and merge into payload sent to Zapier.

