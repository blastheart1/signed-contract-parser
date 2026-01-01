-- Rollback migration: Remove order approvals tables
-- WARNING: This will permanently delete all order approval data
-- Only run this if you need to completely revert the feature
-- Safe to run even if tables don't exist (uses IF EXISTS)

-- Optional: Check for data before dropping (uncomment to use)
-- SELECT COUNT(*) FROM order_approvals WHERE deleted_at IS NULL;
-- SELECT COUNT(*) FROM order_approval_items;
-- SELECT COUNT(*) FROM reference_number_sequence;

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

