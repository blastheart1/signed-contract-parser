---
name: Normalize Empty Numeric Values to Zero
overview: Normalize all empty/null numeric values to "0" across parsing, storage, UI display, and calculations to ensure consistency, simplify code, and improve UX. This affects qty, rate, amount, progressOverallPct, completedAmount, previouslyInvoicedPct, previouslyInvoicedAmount, newProgressPct, and thisBill fields.
todos:
  - id: create-normalization-utility
    content: Create centralized normalizeNumericValue() utility function in lib/utils/numericNormalization.ts
    status: pending
  - id: update-parsing-layer
    content: Update extractOrderItems() in lib/tableExtractor.ts to normalize all numeric fields to "0" during parsing
    status: pending
    dependencies:
      - create-normalization-utility
  - id: update-storage-layer
    content: Update app/api/orders/[id]/items/route.ts to use normalization utility for all 9 numeric fields during insertion
    status: pending
    dependencies:
      - create-normalization-utility
  - id: update-ui-display
    content: Update UI components (OrderTable, InvoiceTable, InvoiceLineItemSelector, InvoiceDetailsModal) to display "0" values instead of "—"
    status: pending
    dependencies:
      - update-storage-layer
  - id: update-calculations
    content: Update calculation logic in invoiceLineItemValidation.ts and InvoiceSummary.tsx to handle "0" strings consistently
    status: pending
    dependencies:
      - update-storage-layer
  - id: simplify-change-tracking
    content: Simplify valuesAreEqual() in changeHistory.ts since 0 vs null comparison is no longer needed
    status: pending
    dependencies:
      - update-storage-layer
  - id: test-parsing
    content: Test initial parsing with empty values, zero values, and missing fields
    status: pending
    dependencies:
      - update-parsing-layer
  - id: test-editing-saving
    content: Test editing and saving order items to ensure no false change tracking and values persist correctly
    status: pending
    dependencies:
      - update-storage-layer
      - update-ui-display
  - id: test-calculations
    content: Test all calculation paths (invoice summaries, validations) with "0" values
    status: pending
    dependencies:
      - update-calculations
  - id: test-backward-compatibility
    content: Test backward compatibility with existing data that may have null values
    status: pending
    dependencies:
      - update-storage-layer
      - update-calculations
---

# Normalize Empty

Numeric Values to "0" - Comprehensive Implementation Plan

## Overview

Normalize all empty/null numeric values to "0" string across the entire system to ensure consistency, simplify code, eliminate 0 vs null comparison issues, and improve UX (show "$0", "0%", "0" instead of "—").

## Affected Fields

- `qty` (Quantity)
- `rate` (Rate)
- `amount` (Amount)
- `progressOverallPct` (% Progress Overall)
- `completedAmount` ($ Completed)
- `previouslyInvoicedPct` (% Previously Invoiced)
- `previouslyInvoicedAmount` ($ Previously Invoiced)
- `newProgressPct` (% New Progress)
- `thisBill` (This Bill)

## Implementation Strategy

### Phase 1: Create Centralized Normalization Utility

**File**: `lib/utils/numericNormalization.ts` (NEW)

- Create reusable `normalizeNumericValue()` function
- Handles: null, undefined, empty string, "0", "0.00", "0.0000" → "0"
- Preserves non-zero values as strings
- Used consistently across all phases

### Phase 2: Update Parsing Layer

**File**: `lib/tableExtractor.ts`

- Update `extractOrderItems()` to normalize all numeric fields to "0" when empty
- Ensure parsed items always have "0" instead of empty strings or null
- Test with various parsing scenarios (empty cells, zero values, missing fields)

### Phase 3: Update Storage Layer

**File**: `app/api/orders/[id]/items/route.ts`

- Replace current normalization logic with centralized utility
- Normalize all 9 numeric fields during item insertion
- Ensure backward compatibility with existing data
- Remove special handling for `previouslyInvoicedPct`, `previouslyInvoicedAmount`, `thisBill` (now all use same logic)

### Phase 4: Update UI Display Components

**Files**:

- `components/dashboard/OrderTable.tsx`
- `components/dashboard/InvoiceTable.tsx`
- `components/dashboard/InvoiceLineItemSelector.tsx`
- `components/dashboard/InvoiceDetailsModal.tsx`

**Changes**:

- Update `formatPercent()` and `formatNumber()` to handle "0" values
- Replace "—" display with "$0", "0%", or "0" for zero values
- Ensure input fields accept "0" as valid value
- Update conditional rendering: `item.amount ? ... : "—"` → `item.amount === "0" ? "$0" : formatCurrency(item.amount)`

### Phase 5: Update Calculation Logic

**Files**:

- `lib/utils/invoiceLineItemValidation.ts`
- `components/dashboard/InvoiceSummary.tsx`
- `app/api/orders/[id]/items/route.ts` (GET endpoint calculations)

**Changes**:

- Simplify `parseDecimal()` to handle "0" strings
- Remove unnecessary null checks (since "0" is always present)
- Update calculations to use `parseFloat(value || "0")` pattern

### Phase 6: Update Change Tracking

**File**: `lib/services/changeHistory.ts`

- Simplify `valuesAreEqual()` since all values are now "0" or non-zero strings
- Remove complex 0 vs null comparison logic (no longer needed)
- Ensure change tracking works correctly with normalized values

### Phase 7: Database Migration (Optional)

**File**: `lib/db/migrations/` (NEW migration if needed)

- Create migration to update existing NULL values to "0" for numeric fields
- Only if we want to clean up existing data
- Can be deferred if backward compatibility is maintained

### Phase 8: Testing & Validation

- Test initial parsing with empty values
- Test editing and saving (no false change tracking)
- Test UI display (shows "0" instead of "—")
- Test calculations (invoice summaries, validations)
- Test change history (no unnecessary entries)
- Test backward compatibility (existing data with null values)

## Safety Measures

1. **Backward Compatibility**: All code must handle both null and "0" during transition
2. **Gradual Rollout**: Implement in phases, test each phase before proceeding
3. **Fallback Logic**: Keep `|| 0` patterns in calculations as safety net
4. **Type Safety**: Ensure TypeScript types allow string "0" values
5. **Validation**: Add tests for edge cases (empty strings, null, undefined, "0", "0.00")

## Risk Mitigation

- **Risk**: Breaking existing calculations that expect null
- **Mitigation**: Keep parseFloat with || 0 fallback, test all calculation paths
- **Risk**: UI breaking with "0" values
- **Mitigation**: Update all display components, test with zero values
- **Risk**: Change tracking false positives
- **Mitigation**: Already handled by valuesAreEqual update, verify with tests
- **Risk**: Parsing issues with empty cells
- **Mitigation**: Test parsing with various empty cell scenarios

## Success Criteria

1. ✅ All empty/null numeric values stored as "0" string
2. ✅ UI displays "$0", "0%", "0" instead of "—"
3. ✅ No false change tracking (0 ↔ null)