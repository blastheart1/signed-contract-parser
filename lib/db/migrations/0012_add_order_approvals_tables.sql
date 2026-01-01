CREATE TYPE "public"."order_approval_stage" AS ENUM('draft', 'sent', 'negotiating', 'approved');--> statement-breakpoint
CREATE TABLE "order_approval_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_approval_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "order_approval_items_order_approval_id_order_item_id_unique" UNIQUE("order_approval_id","order_item_id")
);
--> statement-breakpoint
CREATE TABLE "order_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_no" varchar(20) NOT NULL,
	"vendor_id" uuid NOT NULL,
	"customer_id" varchar(255) NOT NULL,
	"order_id" uuid NOT NULL,
	"stage" "order_approval_stage" DEFAULT 'draft' NOT NULL,
	"pm_approved" boolean DEFAULT false NOT NULL,
	"vendor_approved" boolean DEFAULT false NOT NULL,
	"date_created" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"sent_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "order_approvals_reference_no_unique" UNIQUE("reference_no")
);
--> statement-breakpoint
CREATE TABLE "reference_number_sequence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"last_sequence" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reference_number_sequence_year_unique" UNIQUE("year")
);
--> statement-breakpoint
ALTER TABLE "order_approval_items" ADD CONSTRAINT "order_approval_items_order_approval_id_order_approvals_id_fk" FOREIGN KEY ("order_approval_id") REFERENCES "public"."order_approvals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_approval_items" ADD CONSTRAINT "order_approval_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_approvals" ADD CONSTRAINT "order_approvals_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_approvals" ADD CONSTRAINT "order_approvals_customer_id_customers_dbx_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("dbx_customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_approvals" ADD CONSTRAINT "order_approvals_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_approvals" ADD CONSTRAINT "order_approvals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_approval_items_order_approval_id_idx" ON "order_approval_items" USING btree ("order_approval_id");--> statement-breakpoint
CREATE INDEX "order_approval_items_order_item_id_idx" ON "order_approval_items" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "order_approvals_reference_no_idx" ON "order_approvals" USING btree ("reference_no");--> statement-breakpoint
CREATE INDEX "order_approvals_vendor_id_idx" ON "order_approvals" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "order_approvals_customer_id_idx" ON "order_approvals" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "order_approvals_order_id_idx" ON "order_approvals" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_approvals_stage_idx" ON "order_approvals" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "order_approvals_deleted_at_idx" ON "order_approvals" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "order_approvals_date_created_idx" ON "order_approvals" USING btree ("date_created");--> statement-breakpoint
CREATE INDEX "reference_number_sequence_year_idx" ON "reference_number_sequence" USING btree ("year");