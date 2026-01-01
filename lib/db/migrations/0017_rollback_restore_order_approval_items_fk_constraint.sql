-- Rollback: Restore foreign key constraint from order_approval_items.order_item_id
-- This restores referential integrity between order_approval_items and order_items

ALTER TABLE "order_approval_items" 
ADD CONSTRAINT "order_approval_items_order_item_id_order_items_id_fk" 
FOREIGN KEY ("order_item_id") 
REFERENCES "public"."order_items"("id") 
ON DELETE no action 
ON UPDATE no action;

