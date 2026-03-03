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

**Target:** Efficient use of space on ~390px width (iPhone 13) and similar Android.

**Changes (mobile-only, `md:` breakpoint):**

- **Page padding:** Ensure the main content area does not overflow; layout already gets padding from dashboard layout. If the card or filters feel cramped, use responsive padding on the card (e.g. `CardContent` / `CardHeader` with `px-4 md:px-6`).
- **Filters row:** Search, dropdowns, and buttons – use `flex-wrap` and `gap-2` so they wrap on narrow screens; keep single row on desktop.
- **Table:** Wrap the approvals table in a horizontal-scroll container so the table does not break the layout on small widths:
  - Add a wrapper div around the table: `overflow-x-auto md:overflow-x-visible` and `-webkit-overflow-scrolling: touch`, with `min-w-0` so it can shrink. The table keeps its natural width and scrolls horizontally on mobile; desktop unchanged.
- **Pagination row:** Keep usable on small screens (e.g. wrap or stack if needed with `flex-wrap` and `gap-2`).

**Desktop:** No change (all `md:` variants preserve current behavior).

---

## 4. Vendor negotiation detail page – mobile-friendly layout

**File:** [app/dashboard/vendor-negotiation/[id]/page.tsx](app/dashboard/vendor-negotiation/[id]/page.tsx)

**Target:** Same viewports; table and card use space efficiently.

**Changes (mobile-only):**

- **Card layout:** Use responsive padding on `CardHeader` and `CardContent` (e.g. `px-4 md:px-6`) so the card does not have excessive horizontal padding on small screens.
- **Header block:** The block with Customer Name, Reference, etc. and the action buttons (Send for Negotiation, Preview and Send Email) – ensure it wraps on mobile:
  - Keep `flex flex-row ... gap-4` but add `flex-wrap` so the buttons move below the details block on narrow screens; optionally use `flex-col md:flex-row` for a vertical stack on mobile.
- **Stage / actions:** Ensure stage pills and action buttons wrap with `flex-wrap gap-2` where needed so nothing overflows.

**Desktop:** No change.

---

## 5. Vendor approval order items table – horizontal scroll and typography

**File:** [components/dashboard/VendorApprovalOrderItemsTable.tsx](components/dashboard/VendorApprovalOrderItemsTable.tsx)

**Issue:** Many columns with min widths; on narrow viewports the table overflows. Vertical scroll exists; horizontal does not.

**Changes (mobile-only):**

- **Horizontal scroll wrapper:** Inside the existing `rounded-md border max-h-[600px] overflow-y-auto` div, wrap the `<table>` in a div with:
  - `min-w-0 overflow-x-auto md:overflow-x-visible`
  - `-webkit-overflow-scrolling: touch`
  So on mobile the table can be swiped horizontally; on `md` and up, no horizontal scroll (unchanged).
- **Table font size (optional):** Add `text-xs md:text-sm` to the table element so text is slightly smaller on mobile and more content fits; desktop keeps current size.

**Desktop:** No change.

---

## 6. Summary


| File                                                                                                             | Change                                                                             | Desktop impact |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------- |
| [components/dashboard/Sidebar.tsx](components/dashboard/Sidebar.tsx)                                             | Show mobile toggle only when `!mobileOpen` (hide when navbar open)                 | None           |
| [app/dashboard/layout.tsx](app/dashboard/layout.tsx)                                                             | `isMobile` → marginLeft 0 on main; content padding `pl-14 md:pl-8`                 | None           |
| [app/dashboard/vendor-negotiation/page.tsx](app/dashboard/vendor-negotiation/page.tsx)                           | Table in overflow-x-auto wrapper; responsive padding/card; filters/pagination wrap | None           |
| [app/dashboard/vendor-negotiation/[id]/page.tsx](app/dashboard/vendor-negotiation/[id]/page.tsx)                 | Responsive card padding; header flex-wrap / stack on mobile                        | None           |
| [components/dashboard/VendorApprovalOrderItemsTable.tsx](components/dashboard/VendorApprovalOrderItemsTable.tsx) | Table in overflow-x-auto wrapper; optional text-xs md:text-sm                      | None           |


All behavior and layout at 768px and above remain as they are today.