# Migration Rollback Instructions

## Migration 0008: Add linked_line_items to invoices

### Safety Assessment: ✅ SAFE

This migration is **completely safe** because it:
- Only **adds** a new nullable column
- Does **not modify** any existing data
- Does **not change** any existing columns
- Is **fully reversible**

### What the Migration Does

```sql
ALTER TABLE "invoices" ADD COLUMN "linked_line_items" jsonb;
```

This adds a new nullable JSONB column to store linked line item information for audit trail purposes.

### Impact

- **Before migration**: Invoices table has no `linked_line_items` column
- **After migration**: Invoices table has `linked_line_items` column (NULL for existing invoices)
- **Data loss**: None - all existing invoice data remains intact
- **Breaking changes**: None - existing code continues to work (column is nullable)

### How to Rollback (if needed)

If you need to revert this migration:

#### Option 1: Using the Rollback Migration File

1. **Backup your database first** (recommended):
   ```bash
   # Export invoices table data
   pg_dump -t invoices your_database > invoices_backup.sql
   ```

2. Run the rollback migration manually:
   ```sql
   -- Connect to your database and run:
   ALTER TABLE "invoices" DROP COLUMN IF EXISTS "linked_line_items";
   ```

#### Option 2: Manual SQL Rollback

Connect to your PostgreSQL database and run:

```sql
-- Check if column exists and has data (optional)
SELECT COUNT(*) as invoices_with_linked_items 
FROM invoices 
WHERE linked_line_items IS NOT NULL;

-- Drop the column
ALTER TABLE "invoices" DROP COLUMN IF EXISTS "linked_line_items";
```

### What Gets Deleted on Rollback

- The `linked_line_items` column and all its data
- Any invoice-to-line-item linking information stored in that column
- **Note**: This does NOT affect:
  - Invoice records themselves
  - Invoice amounts, dates, numbers, etc.
  - Order items
  - Any other invoice data

### After Rollback

- The invoice line item linking feature will stop working
- API endpoints will return errors when trying to access `linked_line_items`
- You'll need to remove/comment out code that uses this feature
- Existing invoices remain fully functional (just without linking capability)

### Recommendation

**This migration is safe to run.** The rollback is provided as a safety measure, but you likely won't need it unless you decide to completely remove the feature.
