-- Remove foreign key constraint from order_approval_items.order_item_id
-- This allows order items to be deleted/updated without affecting order approvals
-- Order approvals are an additive feature and should not block existing functionality

ALTER TABLE "order_approval_items" 
DROP CONSTRAINT IF EXISTS "order_approval_items_order_item_id_order_items_id_fk";

