-- Rollback: Remove snapshot fields from order_approval_items table
-- This removes the snapshot data fields added in migration 0018

-- Drop index first
DROP INDEX IF EXISTS "order_approval_items_snapshot_date_idx";

-- Remove columns
ALTER TABLE "order_approval_items" 
DROP COLUMN IF EXISTS "product_service",
DROP COLUMN IF EXISTS "amount",
DROP COLUMN IF EXISTS "qty",
DROP COLUMN IF EXISTS "rate",
DROP COLUMN IF EXISTS "negotiated_vendor_amount",
DROP COLUMN IF EXISTS "snapshot_date";




