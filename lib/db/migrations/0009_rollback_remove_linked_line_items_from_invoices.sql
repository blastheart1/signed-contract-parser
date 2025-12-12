-- Rollback migration: Remove linked_line_items column from invoices table
-- WARNING: This will permanently delete all linked line item data
-- Only run this if you need to completely revert the feature

-- First, verify no critical data exists (optional check)
-- SELECT COUNT(*) FROM invoices WHERE linked_line_items IS NOT NULL;

-- Drop the column
ALTER TABLE "invoices" DROP COLUMN IF EXISTS "linked_line_items";
