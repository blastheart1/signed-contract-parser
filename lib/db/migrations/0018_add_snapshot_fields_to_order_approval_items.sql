-- Add snapshot fields to order_approval_items table
-- These fields store a snapshot of order item data at the time of approval
-- All fields are nullable to support existing records
-- NO foreign key constraints are added (maintains independence from order_items)

ALTER TABLE "order_approval_items" 
ADD COLUMN IF NOT EXISTS "product_service" TEXT,
ADD COLUMN IF NOT EXISTS "amount" DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS "qty" DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS "rate" DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS "negotiated_vendor_amount" DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS "snapshot_date" TIMESTAMP;

-- Add index on snapshot_date for querying by date
CREATE INDEX IF NOT EXISTS "order_approval_items_snapshot_date_idx" ON "order_approval_items" ("snapshot_date");



