---
name: ""
overview: ""
todos: []
isProject: false
---

# Send for Negotiation Email – Plan (updated)

## Principles

- **Additive only:** New template, new endpoints, new button and modal. No changes to existing confirmation email, existing preview/send flow, or existing "Send to Vendor" behavior.
- **Minimal changes:** Reuse existing layout and payload-building patterns; add a second template and a second modal flow alongside the current one.
- **Testing mode:** No stage restriction on the new button (same as "Preview and Send Email"). Production behavior (button only in Negotiating stage) can be gated later via env or a simple condition.

---

## 1. Scope and flow

- **New button:** "Send for Negotiation" + Mail icon, to the **left** of "Preview and Send Email" in the order approval detail header (`[app/dashboard/vendor-negotiation/[id]/page.tsx](app/dashboard/vendor-negotiation/[id]/page.tsx)`).
- **Visibility (testing):** Show when `!isVendor` (no stage check), matching "Preview and Send Email" so both can be tested in any stage.
- **Visibility (production, later):** When ready, restrict to `approval?.stage === 'negotiating' && !isVendor` so the button only appears in Negotiating stage. Use a single condition (e.g. `const showSendForNegotiation = !isVendor && (process.env.NEXT_PUBLIC_ORDER_APPROVAL_STRICT_STAGE !== 'true' || approval?.stage === 'negotiating')`) or a comment/TODO for now and add the stage check in a follow-up.
- **Behavior:** Opens a modal with (1) preview of the **negotiation** email, (2) Send to / CC, (3) Send action that POSTs to the new negotiation webhook (with `emailType: 'negotiation'`) and then calls `PATCH /api/order-approvals/[id]/send` to set stage to `negotiating` and `sentAt`. Existing "Send to Vendor" and "Preview and Send Email" flows stay unchanged.

---

## 2. New email template (negotiation) – draft copy

Same structure and fields as the approval confirmation email; only purpose, intro, disclaimer, and one instructional line change.

**Proposed copy:**


| Section                               | New (negotiation)                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**                             | Order Approval – Action Required                                                                                                                                                                                                                                                                                                                                                                                  |
| **Intro**                             | An order approval has been created for the selected line items below. Please open the link, review the items, and set the RATE for each line. Amount will be calculated automatically (QTY × RATE).                                                                                                                                                                                                               |
| **Instructional (before disclaimer)** | **Please review the line items and input your rate that both parties can review. You may provide your approval after.**                                                                                                                                                                                                                                                                                           |
| **Details table**                     | Same as confirmation (Reference No, Customer Name, Prepared by / PM, Vendor Contact/Phone/Email). **Omit "Vendor Approval Timestamp".**                                                                                                                                                                                                                                                                           |
| **Section heading**                   | Acknowledgement and consent                                                                                                                                                                                                                                                                                                                                                                                       |
| **Disclaimer (present tense)**        | When you approve this order, you will acknowledge and agree that your approval decision, your organization name, and the approval timestamp will be permanently recorded; that this approval is a binding business, legal, and compliance record; that you have reviewed the product/service descriptions, quantities, rates, and amounts; and that you are authorized to approve on behalf of your organization. |
| **Order Items**                       | Same table (PRODUCT/SERVICE, QTY, RATE, AMOUNT).                                                                                                                                                                                                                                                                                                                                                                  |
| **CTA**                               | "View Order Approval & Set Rates" (same link, same placement).                                                                                                                                                                                                                                                                                                                                                    |
| **Footer**                            | This is an automated notice. Please set your rates and complete the approval as requested.                                                                                                                                                                                                                                                                                                                        |


**Subject:** `Order Approval – Action Required: Set Your Rates – {Reference No}`

---

## 3. Implementation outline

### 3.1 `[lib/order-approval-email.ts](lib/order-approval-email.ts)` (additive only)

- Add `CONSENT_REMINDER_NEGOTIATION` (present-tense disclaimer).
- Add `renderOrderApprovalNegotiationHtml(data)` mirroring `renderOrderApprovalHtml`: same layout, negotiation title/intro, **instructional paragraph** before the "Acknowledgement and consent" heading, details table without Vendor Approval Timestamp, negotiation disclaimer, same items table, CTA "View Order Approval & Set Rates", negotiation footer. Reuse shared mobile CSS block (see Section 4).
- Add `buildOrderApprovalNegotiationEmailPayload(approvalId)`: same data loading as `buildOrderApprovalEmailPayload`, call `renderOrderApprovalNegotiationHtml`, return `{ htmlEmail, subject, referenceNo, approvalId, vendorEmail, ... }` plus `**emailType: 'negotiation'`** for Zapier. Do not modify `buildOrderApprovalEmailPayload`; existing confirmation payload can later add `emailType: 'confirmation'` if desired.

### 3.2 New API routes (additive)

- **GET** `app/api/order-approvals/[id]/preview-negotiation-email/route.ts`: Same auth as existing preview (non-vendor only). Call `buildOrderApprovalNegotiationEmailPayload(approvalId)`, return `{ success, data: { approvalId, referenceNo, htmlEmail } }`. No changes to existing `preview-email` route.
- **POST** `app/api/order-approvals/[id]/send-negotiation-webhook/route.ts`: Same auth and cooldown pattern as `test-send-webhook`. Build negotiation payload via `buildOrderApprovalNegotiationEmailPayload`; include `**emailType: 'negotiation'`** in the body posted to Zapier. After successful POST, update approval (stage → negotiating, sentAt) so one click does email + transition. Use same or separate webhook URL (env); if same URL, Zapier can branch on `emailType`. No changes to existing `test-send-webhook` route.

### 3.3 UI – `[app/dashboard/vendor-negotiation/[id]/page.tsx](app/dashboard/vendor-negotiation/[id]/page.tsx)`

- In `CardHeader`, replace the single "Preview and Send Email" button with a **flex container** (e.g. `flex items-center gap-2`):
  - **"Send for Negotiation"** (Mail icon + label): visible when `showSendForNegotiation` (for testing: `!isVendor`; no stage check). On click: open negotiation modal, load preview from `GET .../preview-negotiation-email`, then on Send call `POST .../send-negotiation-webhook` and on success `PATCH .../send` (or webhook route does stage update) and refetch.
  - **"Preview and Send Email"**: unchanged; visible when `showTestSendButton` (existing).
- **Negotiation modal:** New state (e.g. `negotiationDialogOpen`, `negotiationPreviewHtml`, `sendingNegotiation`). Same UX as existing modal: iframe preview, Send to, CC, Send button. No shared state with confirmation modal so existing "Preview and Send Email" flow is untouched.

---

## 4. Mobile optimization (additive, desktop unchanged)

In both `renderOrderApprovalHtml` and `renderOrderApprovalNegotiationHtml`, use a **shared** mobile-only `<style>` block (or a small helper that returns the same CSS string). Add inside existing or new `@media`:

- `.deviceWidth` already at 600px; keep as-is.
- Optional: `.mobilePadding { padding-left: 16px !important; padding-right: 16px !important; }` for content `<td>`s at `max-width: 600px`.
- Optional: `.emailTitle { font-size: 22px !important; line-height: 28px !important; }` for the main title at `max-width: 600px`.

No structural changes to the table; desktop layout and styles unchanged.

---

## 5. Zapier payload – emailType

- **Negotiation webhook:** Include `emailType: 'negotiation'` in the JSON body sent to Zapier.
- **Existing test-send (confirmation):** Optionally add `emailType: 'confirmation'` in a separate small change so Zapier can branch on the same webhook if desired. If not added now, the plan remains additive; add when touching that route later.

---

## 6. File and responsibility summary


| File                                                                                               | Change                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[lib/order-approval-email.ts](lib/order-approval-email.ts)`                                       | Add constant, `renderOrderApprovalNegotiationHtml`, `buildOrderApprovalNegotiationEmailPayload`; shared mobile CSS. No edits to existing exports or confirmation logic. |
| `app/api/order-approvals/[id]/preview-negotiation-email/route.ts`                                  | **New** GET.                                                                                                                                                            |
| `app/api/order-approvals/[id]/send-negotiation-webhook/route.ts`                                   | **New** POST (payload includes `emailType: 'negotiation'`).                                                                                                             |
| `[app/dashboard/vendor-negotiation/[id]/page.tsx](app/dashboard/vendor-negotiation/[id]/page.tsx)` | Add "Send for Negotiation" button (left of existing button), new modal and handlers. No change to existing preview/send or "Send to Vendor" logic.                      |


---

## 7. Instructional + disclaimer (copy/paste)

**Before "Acknowledgement and consent" heading:**  
Please review the line items and input your rate that both parties can review. You may provide your approval after.

**Disclaimer (present tense):**  
When you approve this order, you will acknowledge and agree that your approval decision, your organization name, and the approval timestamp will be permanently recorded; that this approval is a binding business, legal, and compliance record; that you have reviewed the product/service descriptions, quantities, rates, and amounts; and that you are authorized to approve on behalf of your organization.