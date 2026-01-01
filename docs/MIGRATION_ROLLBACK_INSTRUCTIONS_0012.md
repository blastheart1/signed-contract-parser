# Migration Rollback Instructions - 0012: Add Order Approvals Tables

## Migration 0012: Add order_approvals, order_approval_items, and reference_number_sequence tables

### Safety Assessment: ✅ SAFE (Additive Feature)

This migration is **completely safe** because it:
- Only **adds** new tables and enum type
- Does **not modify** any existing data
- Does **not change** any existing tables or columns
- Is **fully reversible**

### What the Migration Does

1. Creates `order_approval_stage` ENUM type with values: 'draft', 'sent', 'negotiating', 'approved'
2. Creates `order_approvals` table with fields:
   - Reference number (YYYY-XXXXX format)
   - Vendor, customer, order relationships
   - Stage tracking
   - PM and vendor approval flags
   - Soft delete support
3. Creates `order_approval_items` table to link selected order items to approvals
4. Creates `reference_number_sequence` table for generating unique reference numbers

### Impact

- **Before migration**: No order approvals feature exists
- **After migration**: Order approvals tables are available for use
- **Data loss**: None - all existing data remains intact
- **Breaking changes**: None - existing code continues to work (new tables are isolated)

### How to Rollback (if needed)

If you need to revert this migration:

#### Option 1: Using the Rollback Migration File

1. **Backup your database first** (recommended):
   ```bash
   # Export order approvals data
   pg_dump -t order_approvals -t order_approval_items -t reference_number_sequence your_database > order_approvals_backup.sql
   ```

2. Run the rollback migration:
   ```bash
   # Connect to your database and run:
   psql your_database < lib/db/migrations/0013_rollback_remove_order_approvals_tables.sql
   ```

#### Option 2: Manual SQL Rollback

Connect to your PostgreSQL database and run:

```sql
-- Check for data before dropping (optional)
SELECT COUNT(*) as active_approvals 
FROM order_approvals 
WHERE deleted_at IS NULL;

SELECT COUNT(*) as approval_items 
FROM order_approval_items;

SELECT COUNT(*) as sequence_records 
FROM reference_number_sequence;

-- Drop foreign key constraints first
ALTER TABLE "order_approval_items" DROP CONSTRAINT IF EXISTS "order_approval_items_order_approval_id_order_approvals_id_fk";
ALTER TABLE "order_approval_items" DROP CONSTRAINT IF EXISTS "order_approval_items_order_item_id_order_items_id_fk";
ALTER TABLE "order_approvals" DROP CONSTRAINT IF EXISTS "order_approvals_vendor_id_vendors_id_fk";
ALTER TABLE "order_approvals" DROP CONSTRAINT IF EXISTS "order_approvals_customer_id_customers_dbx_customer_id_fk";
ALTER TABLE "order_approvals" DROP CONSTRAINT IF EXISTS "order_approvals_order_id_orders_id_fk";
ALTER TABLE "order_approvals" DROP CONSTRAINT IF EXISTS "order_approvals_created_by_users_id_fk";

-- Drop indexes
DROP INDEX IF EXISTS "order_approval_items_order_approval_id_idx";
DROP INDEX IF EXISTS "order_approval_items_order_item_id_idx";
DROP INDEX IF EXISTS "order_approvals_reference_no_idx";
DROP INDEX IF EXISTS "order_approvals_vendor_id_idx";
DROP INDEX IF EXISTS "order_approvals_customer_id_idx";
DROP INDEX IF EXISTS "order_approvals_order_id_idx";
DROP INDEX IF EXISTS "order_approvals_stage_idx";
DROP INDEX IF EXISTS "order_approvals_deleted_at_idx";
DROP INDEX IF EXISTS "order_approvals_date_created_idx";
DROP INDEX IF EXISTS "reference_number_sequence_year_idx";

-- Drop tables
DROP TABLE IF EXISTS "order_approval_items";
DROP TABLE IF EXISTS "order_approvals";
DROP TABLE IF EXISTS "reference_number_sequence";

-- Drop enum type
DROP TYPE IF EXISTS "public"."order_approval_stage";
```

### What Gets Deleted on Rollback

- All order approval records
- All order approval item selections
- All reference number sequence data
- The `order_approval_stage` enum type
- **Note**: This does NOT affect:
  - Order records
  - Order items
  - Customer records
  - Vendor records
  - Any other existing data

### After Rollback

- The vendor negotiation feature will stop working
- All order approval data will be permanently lost
- Reference numbers will need to be regenerated if feature is re-enabled
- The application should handle the missing tables gracefully (check for table existence before queries)

### Re-enabling the Feature

If you rollback and later want to re-enable:
1. Run migration 0012 again
2. Note: Reference numbers will restart from 0 for each year
3. All previous approval data will be lost

