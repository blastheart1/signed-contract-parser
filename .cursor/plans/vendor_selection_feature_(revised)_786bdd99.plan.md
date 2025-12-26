---
name: Vendor Selection Feature (Revised)
overview: Add Vendor Selection as an extension of the Order Items table. The Vendor Selection tab shows different columns (Q-W) of the same table, while Order Items tab shows columns (D-N). PRODUCT/SERVICE column remains visible in both views for reference.
todos:
  - id: db-schema-vendor
    content: Add vendor selection columns (Q-W) to order_items schema in lib/db/schema.ts
    status: completed
  - id: db-migration-vendor
    content: Create database migration to add vendor selection columns
    status: completed
    dependencies:
      - db-schema-vendor
  - id: update-order-item-interface-vendor
    content: Add vendor selection fields to OrderItem interface in lib/tableExtractor.ts
    status: completed
  - id: modify-order-table-columns
    content: Modify OrderTable component to support visibleColumnSet prop and conditionally show Order Items or Vendor Selection columns
    status: completed
    dependencies:
      - update-order-item-interface-vendor
  - id: update-customer-page-tabs-vendor
    content: Update customer detail page to add Vendor Selection tab and pass visibleColumnSet prop to OrderTable
    status: completed
    dependencies:
      - modify-order-table-columns
  - id: update-api-endpoint-vendor
    content: "Update PUT /api/orders/[id]/items to handle vendor selection data - CRITICAL: Preserve invoice remapping logic (lines 365-435) unchanged"
    status: completed
    dependencies:
      - db-migration-vendor
  - id: update-db-helpers-vendor
    content: Update contractHelpers.ts to read/write vendor selection data
    status: completed
    dependencies:
      - db-migration-vendor
  - id: test-invoice-detection
    content: Test that invoices are still detected and linked correctly after vendor selection implementation
    status: completed
    dependencies:
      - update-api-endpoint-vendor
      - update-customer-page-tabs-vendor
---

# Vendor Selection Feature (Revised Implementation)

## Overview

Vendor Selection is an extension of the Order Items table, not a separate table. When users switch between "Order Items" and "Vendor Selection" tabs, they see different column sets of the same table. The PRODUCT/SERVICE column remains visible in both views for reference.

## Key Concept

- **Order Items tab**: Shows columns D-N (Order Items columns) + PRODUCT/SERVICE (D)
- **Vendor Selection tab**: Shows PRODUCT/SERVICE (D) + columns Q-W (Vendor Selection columns)
- Same table, same rows, different visible columns
- Seamless switching between column views

## Database Schema Changes

### 1. Add Vendor Selection Columns to `order_items` Table

**File:** `lib/db/schema.ts`Add the following columns to the `orderItems` table (columns Q-W):

- `vendorName1`: `varchar('vendor_name_1', { length: 255 })` - Column Q: VENDOR NAME 1
- `vendorPercentage`: `decimal('vendor_percentage', { precision: 10, scale: 4 })` - Column R: % (default 100%)
- `totalWorkAssignedToVendor`: `decimal('total_work_assigned_to_vendor', { precision: 15, scale: 2 })` - Column S: Total of all work assigned to vendor (equals AMOUNT)
- `estimatedVendorCost`: `decimal('estimated_vendor_cost', { precision: 15, scale: 2 })` - Column T: Estimated vendor cost (50% of AMOUNT)
- `totalAmountWorkCompleted`: `decimal('total_amount_work_completed', { precision: 15, scale: 2 })` - Column U: TOTAL Amount of work Completed to date
- `vendorBillingToDate`: `decimal('vendor_billing_to_date', { precision: 15, scale: 2 })` - Column V: Vendor billing to date
- `vendorSavingsDeficit`: `decimal('vendor_savings_deficit', { precision: 15, scale: 2 })` - Column W: Vendor Savings (Deficit)

**Migration Workflow Using Drizzle Kit:**

1. Update schema in `lib/db/schema.ts` (add columns above)
2. Generate migration automatically:
   ```bash
      npm run db:generate
   ```


- This will create a migration file in `lib/db/migrations/` based on schema changes
- Review the generated migration file

3. Apply migration:
   ```bash
      npm run db:push
   ```


- This applies schema changes directly to the database
- Alternative: Review generated migration and run `npm run migrate` if you prefer migration files

4. Verify migration:
   ```sql
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'order_items' 
      AND column_name LIKE 'vendor%';
   ```


**Rollback Migration:**Create manual rollback file: `lib/db/migrations/0011_rollback_remove_vendor_selection_from_order_items.sql`

```sql
-- Rollback: Remove vendor selection columns
DO $$ 
BEGIN
    ALTER TABLE "order_items" DROP COLUMN IF EXISTS "vendor_savings_deficit";
    ALTER TABLE "order_items" DROP COLUMN IF EXISTS "vendor_billing_to_date";
    ALTER TABLE "order_items" DROP COLUMN IF EXISTS "total_amount_work_completed";
    ALTER TABLE "order_items" DROP COLUMN IF EXISTS "estimated_vendor_cost";
    ALTER TABLE "order_items" DROP COLUMN IF EXISTS "total_work_assigned_to_vendor";
    ALTER TABLE "order_items" DROP COLUMN IF EXISTS "vendor_percentage";
    ALTER TABLE "order_items" DROP COLUMN IF EXISTS "vendor_name_1";
END $$;
```

To rollback: Run `tsx scripts/run-single-migration.ts 0011_rollback_remove_vendor_selection_from_order_items.sql` or revert schema and use `npm run db:push`

## Component Changes

### 2. Update OrderTable Component

**File:** `components/dashboard/OrderTable.tsx`Modify OrderTable to support column set switching:

- Add a prop `visibleColumnSet: 'order-items' | 'vendor-selection'` to control which columns are visible
- When `visibleColumnSet === 'order-items'`: Show PRODUCT/SERVICE + columns D-N (current behavior)
- When `visibleColumnSet === 'vendor-selection'`: Show PRODUCT/SERVICE + columns Q-W
- Keep all existing functionality (editing, drag-and-drop, etc.)
- Row structure and alignment remain the same
- PRODUCT/SERVICE column always visible in both views

### 3. Update Customer Detail Page Tabs

**File:** `app/dashboard/customers/[id]/page.tsx`

- Change `TabsList` from `grid-cols-2` to `grid-cols-3`
- Add new `TabsTrigger` for "Vendor Selection"
- Add new `TabsContent` for "vendor-selection"
- Pass `visibleColumnSet="vendor-selection"` prop to OrderTable when on Vendor Selection tab
- Pass `visibleColumnSet="order-items"` prop to OrderTable when on Order Items tab (or default)
- Same OrderTable instance, just different visible columns

### 4. Update OrderItem Interface

**File:** `lib/tableExtractor.ts`Add vendor selection fields to the `OrderItem` interface:

```typescript
vendorName1?: string;
vendorPercentage?: number | string;
totalWorkAssignedToVendor?: number | string;
estimatedVendorCost?: number | string;
totalAmountWorkCompleted?: number | string;
vendorBillingToDate?: number | string;
vendorSavingsDeficit?: number | string;
```



### 5. Update API Endpoint

**File:** `app/api/orders/[id]/items/route.ts`

- Update PUT handler to accept and save vendor selection fields (columns Q-W)
- Include vendor selection columns in the database update query
- Ensure backward compatibility (existing order items without vendor data)

### 6. Update Database Helpers

**File:** `lib/db/contractHelpers.ts`

- Update `convertDatabaseToStoredContract` to include vendor selection fields when reading from database
- Update `saveContractToDatabase` to save vendor selection fields when writing to database

## Implementation Details

### Column Visibility Logic

```typescript
// In OrderTable component
const showOrderItemsColumns = visibleColumnSet === 'order-items' || !visibleColumnSet;
const showVendorSelectionColumns = visibleColumnSet === 'vendor-selection';

// Always show PRODUCT/SERVICE column
<TableHead>PRODUCT/SERVICE</TableHead>

// Conditionally show Order Items columns (D-N)
{showOrderItemsColumns && (
  <>
    <TableHead>QTY</TableHead>
    <TableHead>RATE</TableHead>
    <TableHead>AMOUNT</TableHead>
    // ... other Order Items columns
  </>
)}

// Conditionally show Vendor Selection columns (Q-W)
{showVendorSelectionColumns && (
  <>
    <TableHead>VENDOR NAME 1</TableHead>
    <TableHead>%</TableHead>
    <TableHead>Total of all work assigned to vendor</TableHead>
    // ... other Vendor Selection columns
  </>
)}
```



### Default Value Calculations

- `vendorPercentage`: Default to 100 (can be edited)
- `totalWorkAssignedToVendor`: Auto-calculated from `amount` field (equals AMOUNT)
- `estimatedVendorCost`: Auto-calculated as `amount * 0.5`
- Other fields: Start as empty/null, user fills in manually

### Data Flow

1. Load order items from database (includes vendor selection data if exists)
2. Pass items to OrderTable with `visibleColumnSet` prop
3. OrderTable renders appropriate columns based on `visibleColumnSet`
4. User edits data in visible columns
5. On save, send all data (both Order Items and Vendor Selection) to API
6. API saves all data to order_items table

### Backward Compatibility

- Existing order items without vendor selection data will show empty/null values
- Invoicing functionality remains unchanged (uses Order Items columns D-N)

## Rollback Procedure

If the implementation doesn't work as expected:

1. **Revert Code Changes**
   ```bash
      git checkout HEAD -- lib/db/schema.ts
      git checkout HEAD -- lib/tableExtractor.ts
      git checkout HEAD -- components/dashboard/OrderTable.tsx
      git checkout HEAD -- app/dashboard/customers/[id]/page.tsx
      git checkout HEAD -- app/api/orders/[id]/items/route.ts
      git checkout HEAD -- lib/db/contractHelpers.ts
   ```




2. **Run Rollback Migration**
   ```bash
      # Option A: Run rollback migration file
      tsx scripts/run-single-migration.ts 0011_rollback_remove_vendor_selection_from_order_items.sql
      
      # Option B: Revert schema and use drizzle-kit push
      # 1. Revert lib/db/schema.ts to remove vendor columns
      # 2. Run: npm run db:push
   ```




3. **Verify Rollback**
   ```sql
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'order_items' 
      AND column_name LIKE 'vendor%';
      -- Should return 0 rows
   ```




4. **Clear Cache and Restart**
   ```bash
      rm -rf .next
      npm run dev
   ```




## Critical: Invoice Linking Preservation

### Problem Statement

Previous implementation broke invoice detection because invoice linking relies on `orderItemId` references in the `linkedLineItems` JSONB field. When order items are saved, the system uses `rowIndex` as a stable identifier to remap invoice links from old itemIds to new itemIds.

### Solution Requirements

1. **Preserve Invoice Remapping Logic**

- The invoice remapping code in `PUT /api/orders/[id]/items` (lines 365-435) must remain **completely unchanged**
- This logic maps old itemIds → rowIndex → new itemIds to preserve invoice links
- Do NOT modify the remapping algorithm or its dependencies

2. **Additive Field Addition Only**

- Vendor selection fields must be added to `normalizedItem` object **without changing**:
    - The `rowIndex` assignment logic (line 317: `rowIndex: index`)
    - The order of field processing
    - The structure of existing fields
- Add vendor fields at the end of the `normalizedItem` object, after all existing fields

3. **Testing Requirements**

- **MUST test**: After adding vendor selection, verify that:
    - Existing invoices are still detected and displayed correctly
    - Invoice `linkedLineItems` are properly remapped when order items are saved
    - No invoices are lost or become orphaned
    - Invoice amounts and line item links remain intact

4. **Implementation Safeguards**

- When modifying `app/api/orders/[id]/items/route.ts`:
    - Add vendor selection fields to `normalizedItem` object (around line 352)