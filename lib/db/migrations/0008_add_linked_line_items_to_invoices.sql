-- Add linked_line_items column to invoices table (safe - nullable column)
-- This migration is idempotent (can be run multiple times safely)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'linked_line_items'
    ) THEN
        ALTER TABLE "invoices" ADD COLUMN "linked_line_items" jsonb;
    END IF;
END $$;
