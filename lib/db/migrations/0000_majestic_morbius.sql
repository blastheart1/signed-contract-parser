CREATE TYPE "public"."change_type" AS ENUM('cell_edit', 'row_add', 'row_delete', 'row_update', 'customer_edit', 'order_edit');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('maincategory', 'subcategory', 'item');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_updates', 'completed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'contract_manager', 'sales_rep', 'accountant', 'viewer', 'vendor');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pending', 'active', 'suspended');--> statement-breakpoint
CREATE TABLE "change_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"order_item_id" uuid,
	"customer_id" varchar(255),
	"change_type" "change_type" NOT NULL,
	"field_name" varchar(255) NOT NULL,
	"old_value" text,
	"new_value" text,
	"row_index" integer,
	"changed_by" uuid NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"dbx_customer_id" varchar(255) PRIMARY KEY NOT NULL,
	"client_name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"street_address" varchar(255) NOT NULL,
	"city" varchar(100) NOT NULL,
	"state" varchar(50) NOT NULL,
	"zip" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"row_index" integer NOT NULL,
	"column_a_label" varchar(50),
	"column_b_label" varchar(50),
	"product_service" text NOT NULL,
	"qty" numeric(15, 2),
	"rate" numeric(15, 2),
	"amount" numeric(15, 2),
	"progress_overall_pct" numeric(10, 4),
	"completed_amount" numeric(15, 2),
	"previously_invoiced_pct" numeric(10, 4),
	"previously_invoiced_amount" numeric(15, 2),
	"new_progress_pct" numeric(10, 4),
	"this_bill" numeric(15, 2),
	"item_type" "item_type" NOT NULL,
	"main_category" varchar(255),
	"sub_category" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar(255) NOT NULL,
	"order_no" varchar(255) NOT NULL,
	"order_date" timestamp,
	"order_po" varchar(255),
	"order_due_date" timestamp,
	"order_type" varchar(100),
	"order_delivered" boolean DEFAULT false,
	"quote_expiration_date" timestamp,
	"order_grand_total" numeric(15, 2) NOT NULL,
	"progress_payments" text,
	"balance_due" numeric(15, 2) NOT NULL,
	"sales_rep" varchar(255),
	"status" "order_status" DEFAULT 'pending_updates',
	"eml_blob_url" varchar(500),
	"eml_filename" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "orders_order_no_unique" UNIQUE("order_no")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"email" varchar(255),
	"role" "user_role",
	"status" "user_status" DEFAULT 'pending' NOT NULL,
	"sales_rep_name" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_login" timestamp,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "change_history" ADD CONSTRAINT "change_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_history" ADD CONSTRAINT "change_history_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_history" ADD CONSTRAINT "change_history_customer_id_customers_dbx_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("dbx_customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_history" ADD CONSTRAINT "change_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_dbx_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("dbx_customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;