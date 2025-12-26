-- Rollback migration: Remove vendor selection columns from order_items table
-- WARNING: This will permanently delete all vendor selection data
-- Only run this if you need to completely revert the feature
-- Safe to run even if columns don't exist (uses IF EXISTS)

-- Optional: Check for data before dropping (uncomment to use)
-- SELECT COUNT(*) FROM order_items 
-- WHERE vendor_name_1 IS NOT NULL 
--    OR vendor_percentage IS NOT NULL 
--    OR total_work_assigned_to_vendor IS NOT NULL
--    OR estimated_vendor_cost IS NOT NULL
--    OR total_amount_work_completed IS NOT NULL
--    OR vendor_billing_to_date IS NOT NULL
--    OR vendor_savings_deficit IS NOT NULL;

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

