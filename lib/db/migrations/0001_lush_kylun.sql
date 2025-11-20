CREATE TYPE "public"."customer_status" AS ENUM('pending_updates', 'completed');--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"invoice_number" varchar(255),
	"invoice_date" timestamp,
	"invoice_amount" numeric(15, 2),
	"payments_received" numeric(15, 2) DEFAULT '0',
	"exclude" boolean DEFAULT false,
	"row_index" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "status" "customer_status" DEFAULT 'pending_updates';--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;