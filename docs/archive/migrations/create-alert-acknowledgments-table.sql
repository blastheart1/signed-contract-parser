-- Create alert_acknowledgments table
-- Run this in your Neon production database SQL editor

CREATE TABLE IF NOT EXISTS "alert_acknowledgments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar(255) NOT NULL,
	"alert_type" varchar(50) NOT NULL,
	"acknowledged_by" uuid NOT NULL,
	"acknowledged_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "alert_acknowledgments_customer_id_alert_type_unique" UNIQUE("customer_id","alert_type")
);

-- Add foreign key constraints
ALTER TABLE "alert_acknowledgments" 
ADD CONSTRAINT "alert_acknowledgments_customer_id_customers_dbx_customer_id_fk" 
FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("dbx_customer_id") 
ON DELETE no action ON UPDATE no action;

ALTER TABLE "alert_acknowledgments" 
ADD CONSTRAINT "alert_acknowledgments_acknowledged_by_users_id_fk" 
FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") 
ON DELETE no action ON UPDATE no action;

-- Create index for performance
CREATE INDEX IF NOT EXISTS "alert_acknowledgments_customer_id_idx" 
ON "alert_acknowledgments"("customer_id");
