-- Migration: Make order_id nullable in order_approvals table
-- This allows approvals to be created without a specific order,
-- since items can be selected from multiple orders for a customer

ALTER TABLE "order_approvals" ALTER COLUMN "order_id" DROP NOT NULL;

