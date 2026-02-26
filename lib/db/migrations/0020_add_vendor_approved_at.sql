-- Add vendor_approved_at to order_approvals (timestamp when vendor last approved; set on approve only)
ALTER TABLE "order_approvals" ADD COLUMN IF NOT EXISTS "vendor_approved_at" TIMESTAMP;
