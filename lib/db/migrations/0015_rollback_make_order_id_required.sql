-- Rollback migration: Make order_id required again in order_approvals table
-- WARNING: This will fail if there are any NULL values in order_id
-- First, ensure no NULL values exist by setting order_id from selected items

-- Update NULL order_ids to the order_id from the first selected item
UPDATE "order_approvals" 
SET "order_id" = (
  SELECT "order_items"."order_id" 
  FROM "order_items" 
  WHERE "order_items"."id" IN (
    SELECT "order_approval_items"."order_item_id" 
    FROM "order_approval_items" 
    WHERE "order_approval_items"."order_approval_id" = "order_approvals"."id"
    LIMIT 1
  )
  LIMIT 1
) 
WHERE "order_id" IS NULL;

-- If any approvals still have NULL order_id (no selected items), set to a default order
-- This should not happen in practice, but handle edge case
UPDATE "order_approvals" 
SET "order_id" = (
  SELECT "id" FROM "orders" 
  WHERE "customer_id" = "order_approvals"."customer_id" 
  LIMIT 1
)
WHERE "order_id" IS NULL;

-- Now make it required again
ALTER TABLE "order_approvals" ALTER COLUMN "order_id" SET NOT NULL;

