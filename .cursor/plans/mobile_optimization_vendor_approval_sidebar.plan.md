---
name: ""
overview: ""
todos: []
isProject: false
---

# Mobile optimization: Sidebar toggle + Vendor negotiation (iPhone 13+ / recent Android)

## Principle

All changes are **mobile-only** (viewport < 768px via Tailwind `md:` or `isMobile`). Desktop/laptop (≥768px) keeps current layout and styling. Target: efficient use of screen space on iPhone 13 onwards (~390px width) and recent Android devices.

---

## Recommendation: Separate mobile layout

**Prefer a separate mobile layout** for the vendor-only experience (as a start). This allows reinventing the mobile UX (stacked headers, card lists for wide tables, full-width actions) while following the same design language (colors, typography, components). Desktop layout and pages stay untouched; mobile gets its own layout and/or view that switches in below `md`. Implementation options: (1) a dedicated mobile layout component used when `isMobile` in the dashboard layout, or (2) route-based layout (e.g. `layout.mobile.tsx` or a wrapper that conditionally renders mobile vs desktop structure). Take note of this for implementation.

---

## Mobile-Responsive Design Instruction (authoritative)

**Scope:** Mobile optimization only — no desktop layouts should be changed.  
**Breakpoint:** All mobile-specific changes must be scoped below `md` (< 768px). Desktop styles start at `md:`.

### Layout

- Page headers must stack vertically on mobile (`flex-col`) and switch to horizontal on desktop (`sm:flex-row`).
- Action buttons in headers must stretch to fill the row on mobile (`flex-1`) and return to natural width on desktop (`sm:flex-none`).
- Search inputs must be full-width on mobile (`w-full`) and fixed-width on desktop (`sm:w-64`).
- Card headers follow the same stacking pattern as page headers.

### Tables

- **Tables with ≤ 3 columns** — keep as-is.
- **Tables with 4–5 columns** — wrap in `overflow-x-auto` with a `min-w` set on the table.
- **Tables with 5+ columns** — replace with a **card list on mobile** (`md:hidden`) and keep the table for desktop (`hidden md:block`).
  - Mobile card list structure: reference/ID + status badge on top row → key-value label rows in the middle → date + action icons on the bottom row.

### Dialogs & Modals

- Add `mx-4` on mobile to prevent edge-to-edge stretching.
- Footer buttons must stack vertically on mobile (`flex-col gap-2`) and go side-by-side on desktop (`sm:flex-row`).
- All buttons inside a dialog footer must be full-width on mobile (`w-full sm:w-auto`).

### Touch & Tap Targets

- Every tappable element (icon buttons, links, toggles) must be **at least 44×44px** on mobile.
- Tooltips are desktop-only — on mobile, show labels inline or omit.

### Typography

- Page titles: `text-2xl sm:text-3xl`
- Section titles: `text-lg sm:text-xl`
- Body: `text-sm sm:text-base`
- Captions/meta: `text-xs text-muted-foreground`

### Spacing

- Page containers: `p-4 sm:p-6 lg:p-8`
- Section gaps: `space-y-4 sm:space-y-6`

### Overflow

- Never allow unintended horizontal scroll — all flex containers must allow wrapping (`flex-wrap`).
- Truncate long text on mobile: `truncate max-w-[200px] sm:max-w-none`

### Checklist (per screen/component)

- Tested at 375px (iPhone SE) and 390px (iPhone 14).
- No horizontal overflow.
- All tap targets ≥ 44px.
- Tables handled per the column-count rule above.
- Dialogs have `mx-4` and stacked footer buttons.
- Desktop layout verified unchanged at 1280px.

---

## 1. Sidebar: Hide toggle button when navbar is open on mobile

**File:** [components/dashboard/Sidebar.tsx](components/dashboard/Sidebar.tsx)

**Issue:** The hamburger/close button is fixed at `top-4 left-4 z-50`. When the sidebar is open on mobile, the same button shows the close (X) icon and overlaps the drawer, which is not aesthetically pleasing.

**Change:** Render the mobile toggle button **only when the sidebar is closed**. When the sidebar is open, hide the button; the user closes the drawer by tapping the overlay.

- Current: `{isMobile && showToggle && isMounted && ( <Button>...</Button> )}`
- New: `{isMobile && showToggle && isMounted && !mobileOpen && ( <Button>...</Button> )}`

So the button shows the **Menu (hamburger)** icon when the drawer is closed and is not rendered when `mobileOpen` is true. No close button overlap when the navbar is open.

**Desktop:** Unchanged (toggle is only relevant when `isMobile`).

---

## 2. Dashboard layout: Full-width main content on mobile

**File:** [app/dashboard/layout.tsx](app/dashboard/layout.tsx)

**Issue:** Main content always has `marginLeft: sidebarWidth` (256 or 80). On mobile the sidebar is a drawer, but the main area still loses 256px, leaving very little width.

**Change:**

- Add `isMobile` state (e.g. `window.innerWidth < 768`), updated on mount and `resize`.
- Set `marginLeft: isMobile ? 0 : sidebarWidth` on `motion.main` so main is full-width on mobile.
- On the inner content wrapper, use responsive padding so content does not sit under the hamburger when the drawer is closed: e.g. `p-8 pl-14 md:pl-8` (mobile: extra left padding; md+: same as today).

**Desktop:** No change (≥768px → `isMobile` false → same margin and padding).

---

## 3. Vendor negotiation list page – mobile-friendly layout

**File:** [app/dashboard/vendor-negotiation/page.tsx](app/dashboard/vendor-negotiation/page.tsx)

**Target:** Efficient use of space on ~390px width (iPhone 13) and similar Android. Follow **Mobile-Responsive Design Instruction** above.

**Changes (mobile-only, `md:` breakpoint):**

- **Page header:** Stack vertically on mobile (`flex-col`), horizontal on desktop (`sm:flex-row`). Action buttons stretch on mobile (`flex-1`), natural width on desktop (`sm:flex-none`).
- **Page padding:** Use `p-4 sm:p-6 lg:p-8`; section gaps `space-y-4 sm:space-y-6`.
- **Card header:** Same stacking as page headers; search full-width on mobile (`w-full sm:w-64`).
- **Table (Order Approvals):** This table has **6 columns** (Ref No, Vendor, Customer, Date Created, Stage, Actions). Per the design instruction, **tables with 5+ columns** use a **card list on mobile** (`md:hidden`) and the table on desktop (`hidden md:block`). Mobile card structure: reference/ID + status badge on top row → key-value rows (Vendor, Customer, Date) in the middle → action icons on the bottom row. Each card remains tappable to open the detail page.
- **Pagination row:** Use `flex-wrap gap-2` so it stays usable on small screens.

**Desktop:** No change (all `md:` variants preserve current behavior).

---

## 4. Vendor negotiation detail page – mobile-friendly layout

**File:** [app/dashboard/vendor-negotiation/[id]/page.tsx](app/dashboard/vendor-negotiation/[id]/page.tsx)

**Target:** Same viewports; follow **Mobile-Responsive Design Instruction** (layout, spacing, touch).

**Changes (mobile-only):**

- **Page container:** Use `p-4 sm:p-6 lg:p-8`; section gaps `space-y-4 sm:space-y-6`.
- **Card layout:** Responsive padding on `CardHeader` and `CardContent` (e.g. `px-4 md:px-6`).
- **Header block:** Stack vertically on mobile (`flex-col`), horizontal on desktop (`sm:flex-row`). Action buttons (Send for Negotiation, Preview and Send Email) stretch on mobile (`flex-1`), natural width on desktop (`sm:flex-none`).
- **Stage / actions:** Use `flex-wrap gap-2` so stage pills and action buttons wrap; no horizontal overflow.
- **Typography:** Page title `text-2xl sm:text-3xl`; section titles `text-lg sm:text-xl`; body `text-sm sm:text-base`.
- **Touch:** All tappable elements ≥ 44×44px on mobile; tooltips desktop-only or inline labels on mobile.

**Desktop:** No change.

---

## 5. Vendor approval order items table – mobile handling

**File:** [components/dashboard/VendorApprovalOrderItemsTable.tsx](components/dashboard/VendorApprovalOrderItemsTable.tsx)

**Context:** This table has **7+ columns** (checkbox, PRODUCT/SERVICE, QTY, RATE, AMOUNT, Est. Vendor Cost, Price Difference). Per the design instruction, **tables with 5+ columns** use a **card list on mobile** (`md:hidden`) and the table on desktop (`hidden md:block`).

**Changes (mobile-only):**

- **Option A (per spec):** On mobile, render a **card list** instead of the table: each row becomes a card (product/service + key values + amount/rate/actions). Desktop keeps the existing table unchanged.
- **Option B (minimal):** If card list is deferred, wrap the table in `overflow-x-auto` with `min-w` and `-webkit-overflow-scrolling: touch` so the table scrolls horizontally on mobile; ensure tap targets (checkboxes, buttons) are at least 44×44px. Desktop unchanged.
- **Typography:** Use `text-sm sm:text-base` for body; section titles `text-lg sm:text-xl`.
- **Touch:** All icon buttons and tappable cells must be ≥ 44×44px on mobile; tooltips desktop-only or show labels inline on mobile.

**Desktop:** No change.

---

## 6. Summary


| File                                                                                                             | Change                                                                                              | Desktop impact |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------- |
| [components/dashboard/Sidebar.tsx](components/dashboard/Sidebar.tsx)                                             | Show mobile toggle only when `!mobileOpen` (hide when navbar open)                                  | None           |
| [app/dashboard/layout.tsx](app/dashboard/layout.tsx)                                                             | `isMobile` → marginLeft 0 on main; content padding `pl-14 md:pl-8`                                  | None           |
| [app/dashboard/vendor-negotiation/page.tsx](app/dashboard/vendor-negotiation/page.tsx)                           | Card list on mobile (6 cols); stacked header; responsive padding; filters/pagination wrap           | None           |
| [app/dashboard/vendor-negotiation/[id]/page.tsx](app/dashboard/vendor-negotiation/[id]/page.tsx)                 | Responsive card padding; header flex-wrap / stack on mobile                                         | None           |
| [components/dashboard/VendorApprovalOrderItemsTable.tsx](components/dashboard/VendorApprovalOrderItemsTable.tsx) | Per design instruction: card list on mobile for 5+ columns, or overflow-x wrapper; 44px tap targets | None           |


**Dialogs (vendor-negotiation and elsewhere):** Per Mobile-Responsive Design Instruction — add `mx-4` on mobile; footer `flex-col gap-2` on mobile, `sm:flex-row` on desktop; footer buttons `w-full sm:w-auto`.

**Checklist:** For each screen/component: test at 375px and 390px; no horizontal overflow; all tap targets ≥ 44px; tables per column-count rule; dialogs with `mx-4` and stacked footer; desktop verified unchanged at 1280px.

All behavior and layout at 768px and above remain as they are today.