# Vendor Negotiation Updates (Refined Plan)

## Overview
Minimal, safe changes to vendor negotiation feature following existing code patterns. All changes use existing state management and API patterns to minimize risk.

## Principles
- Use existing state patterns (isEditMode, isAmountEditMode)
- Leverage existing snapshot fields (qty, rate, amount in order_approval_items)
- Preserve all existing functionality
- Add conditional rendering based on user role (isVendor pattern)
- Follow existing API endpoint patterns

## Changes Summary

### 1. Remove "% Progress Overall" Column
**File**: `components/dashboard/VendorApprovalOrderItemsTable.tsx`
- Remove TableHead for "% Progress Overall" (line ~617)
- Remove TableCell displaying progressPct (line ~762-764)
- Update colspan calculations where Progress Overall is counted

**Risk**: Low - simple removal, no dependencies

### 2. PM QTY-Only Edit Mode (Replace Current Amount Edit)
**File**: `components/dashboard/VendorApprovalOrderItemsTable.tsx`
- **Rename/Refactor** `isAmountEditMode` → add `isQtyEditMode` for PM
- When PM clicks "Edit Items": allow editing QTY only
- AMOUNT field: readonly, computed as QTY × RATE (from snapshot or order_items)
- Display computed AMOUNT in table
- Save QTY updates to `order_approval_items.qty` snapshot field

**API**: `app/api/order-approvals/[id]/items/route.ts`
- Extend PATCH to accept `qty` updates (similar to existing amounts update)
- Compute and save `amount = qty × rate` when qty is updated

**Risk**: Medium - refactors existing edit mode, but preserves pattern

### 3. Vendor Rate Edit Mode
**File**: `components/dashboard/VendorApprovalOrderItemsTable.tsx`
- Add `isRateEditMode` state (parallel to isAmountEditMode pattern)
- Add "Edit Rates" button (only visible for vendors, similar to "Edit Items")
- When vendor edits RATE: input field for RATE only
- AMOUNT auto-computes as QTY × RATE (displayed, not editable)
- Save RATE updates to `order_approval_items.rate` snapshot field

**API**: `app/api/order-approvals/[id]/items/route.ts`
- Extend PATCH to accept `rates` array (similar to amounts pattern)
- Compute and save `amount = qty × rate` when rate is updated

**Risk**: Medium - new mode, but follows existing pattern exactly

### 4. Price Difference Calculation Update
**File**: `components/dashboard/VendorApprovalOrderItemsTable.tsx`
- Update calculation: `(Negotiated Amount) - (50% of Original Amount)`
- Original Amount from `order_items.amount` (via orderItem join)
- Only visible for non-vendor users (existing `!isVendor` check)

**Risk**: Low - calculation change only, no structural changes

### 5. Separate Approve Button for PM
**File**: `app/dashboard/vendor-negotiation/[id]/page.tsx`
- "Send to Vendor" button: unchanged, moves stage 'draft' → 'negotiating'
- Add separate "Approve (PM)" button in negotiating stage (line ~538-575)
- Keep existing approval logic (pmApproved flag)
- Stage stays in 'negotiating' until both approve (existing logic)

**Risk**: Low - UI change only, uses existing approval API

### 6. Vendor Link Restrictions
**File**: `app/dashboard/vendor-negotiation/page.tsx`
- Wrap Vendor/Customer Link components with conditional (line ~440-468)
- If `user?.role === 'vendor'`: render plain text instead of Link
- Use existing `user?.role !== 'vendor'` pattern (line 317, 323)

**Risk**: Low - conditional rendering only

### 7. Vendor Stage Filter
**File**: `app/api/order-approvals/route.ts`
- Add stage filter for vendor users (line ~51-79)
- When `isVendor === true`: add `inArray(schema.orderApprovals.stage, ['negotiating', 'approved'])` to whereConditions
- Non-vendor users: no stage filter (existing behavior)

**Risk**: Low - additive filter, doesn't affect non-vendors

## Implementation Details

### State Management Pattern (VendorApprovalOrderItemsTable)
```typescript
// Existing states:
- isEditMode: boolean (selection mode)
- isAmountEditMode: boolean (amount edit mode)

// New states:
- isQtyEditMode: boolean (PM qty edit mode) - replaces isAmountEditMode for PM
- isRateEditMode: boolean (vendor rate edit mode) - new

// Edit mode logic:
if (isVendor) {
  // Vendor: can enter isRateEditMode
} else {
  // PM: can enter isQtyEditMode (replaces isAmountEditMode)
}
```

### API Endpoint Pattern (PATCH /api/order-approvals/[id]/items)
```typescript
// Existing: { amounts: [{ orderApprovalItemId, negotiatedVendorAmount }] }
// Extended: { qty?: [{ orderApprovalItemId, qty }], rates?: [{ orderApprovalItemId, rate }] }
// All update snapshot fields, compute amount = qty × rate
```

### Data Flow
1. PM edits QTY → saves to `order_approval_items.qty` → API computes `amount = qty × rate`
2. Vendor edits RATE → saves to `order_approval_items.rate` → API computes `amount = qty × rate`
3. Both see computed AMOUNT (from snapshot or computed)
4. Price difference: `negotiatedVendorAmount - (0.5 × originalAmount)`

## Files to Modify

1. **components/dashboard/VendorApprovalOrderItemsTable.tsx**
   - Remove Progress Overall column
   - Add isQtyEditMode state (PM)
   - Add isRateEditMode state (vendor)
   - Update edit handlers
   - Update price difference calculation
   - Update table rendering

2. **app/api/order-approvals/[id]/items/route.ts**
   - Extend PATCH to handle qty and rate updates
   - Compute amount = qty × rate

3. **app/dashboard/vendor-negotiation/[id]/page.tsx**
   - Add separate Approve button for PM

4. **app/dashboard/vendor-negotiation/page.tsx**
   - Conditionally render links vs text for vendors

5. **app/api/order-approvals/route.ts**
   - Add stage filter for vendors

## Testing Checklist

- [ ] PM can edit QTY, AMOUNT auto-computes
- [ ] Vendor can edit RATE, AMOUNT auto-computes
- [ ] Progress Overall column removed
- [ ] Price difference shows (Negotiated - 50% Original)
- [ ] Separate Approve button for PM works
- [ ] Send to Vendor button unchanged
- [ ] Vendor links are plain text (not clickable)
- [ ] Vendor only sees negotiating/approved stages
- [ ] Existing functionality preserved (item selection, etc.)
- [ ] No changes to order_items table (only order_approval_items snapshot)

## Backward Compatibility

- All changes are additive or replace existing patterns
- Snapshot fields already exist in schema
- No schema migrations needed
- Existing approvals continue to work
- API endpoints backward compatible (new fields optional)
