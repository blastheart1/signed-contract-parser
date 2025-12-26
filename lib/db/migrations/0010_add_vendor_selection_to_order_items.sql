-- Migration: Add vendor selection columns to order_items table
-- This migration adds the vendor selection columns (Q-W) to support the Vendor Selection feature

DO $$ BEGIN
  -- Add vendor selection columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'vendor_name_1') THEN
    ALTER TABLE "order_items" ADD COLUMN "vendor_name_1" varchar(255);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'vendor_percentage') THEN
    ALTER TABLE "order_items" ADD COLUMN "vendor_percentage" numeric(10, 4);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'total_work_assigned_to_vendor') THEN
    ALTER TABLE "order_items" ADD COLUMN "total_work_assigned_to_vendor" numeric(15, 2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'estimated_vendor_cost') THEN
    ALTER TABLE "order_items" ADD COLUMN "estimated_vendor_cost" numeric(15, 2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'total_amount_work_completed') THEN
    ALTER TABLE "order_items" ADD COLUMN "total_amount_work_completed" numeric(15, 2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'vendor_billing_to_date') THEN
    ALTER TABLE "order_items" ADD COLUMN "vendor_billing_to_date" numeric(15, 2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'vendor_savings_deficit') THEN
    ALTER TABLE "order_items" ADD COLUMN "vendor_savings_deficit" numeric(15, 2);
  END IF;
END $$;

