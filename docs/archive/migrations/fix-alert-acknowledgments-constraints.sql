-- Fix alert_acknowledgments table constraints
-- The table has incorrect UNIQUE constraints on individual columns
-- We need to remove those and keep only the composite unique constraint

-- First, drop the incorrect unique constraints if they exist
ALTER TABLE "alert_acknowledgments" 
DROP CONSTRAINT IF EXISTS "alert_acknowledgments_customer_id_key";

ALTER TABLE "alert_acknowledgments" 
DROP CONSTRAINT IF EXISTS "alert_acknowledgments_alert_type_key";

-- Verify the composite unique constraint exists (it should already be there)
-- If not, we'll need to add it:
-- ALTER TABLE "alert_acknowledgments" 
-- ADD CONSTRAINT "alert_acknowledgments_customer_id_alert_type_unique" 
-- UNIQUE("customer_id","alert_type");

-- Note: The composite unique constraint should already exist from the original CREATE TABLE
-- This script just removes the incorrect individual column unique constraints
