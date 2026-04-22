CREATE TYPE "public"."atlas_role" AS ENUM('hr_admin', 'it_admin', 'ops_admin', 'finance', 'manager', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."atlas_step_status" AS ENUM('queued', 'active', 'done', 'blocked', 'skipped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."atlas_system_status" AS ENUM('provisioned', 'invited', 'pending', 'failed', 'suspend-pending', 'revoked', 'archived');--> statement-breakpoint
CREATE TYPE "public"."atlas_workflow_status" AS ENUM('pending', 'in-progress', 'blocked', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."atlas_workflow_type" AS ENUM('onboarding', 'offboarding');--> statement-breakpoint
CREATE TABLE "atlas_access_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"system" varchar(50) NOT NULL,
	"status" "atlas_system_status",
	"external_id" varchar(255),
	"last_synced_at" timestamp,
	"provisioned_at" timestamp,
	"revoked_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "atlas_access_accounts_employee_id_system_unique" UNIQUE("employee_id","system")
);
--> statement-breakpoint
CREATE TABLE "atlas_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" varchar(255) NOT NULL,
	"actor_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"detail" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "atlas_email_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"employee_id" uuid,
	"template_key" varchar(100) NOT NULL,
	"to_address" varchar(255) NOT NULL,
	"subject" varchar(500),
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp,
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"provider_message_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "atlas_employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_code" varchar(20) NOT NULL,
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255) NOT NULL,
	"personal_email" varchar(255),
	"company_email" varchar(255),
	"phone" varchar(50),
	"position" varchar(255),
	"department" varchar(100),
	"location" varchar(255),
	"employment_type" varchar(50) DEFAULT 'full-time',
	"manager_id" uuid,
	"manager_name" varchar(255),
	"start_date" timestamp,
	"end_date" timestamp,
	"access_preset" varchar(50),
	"salary_encrypted" text,
	"comp_visibility" varchar(30) DEFAULT 'restricted',
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "atlas_employees_employee_code_unique" UNIQUE("employee_code")
);
--> statement-breakpoint
CREATE TABLE "atlas_integration_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"step_id" uuid,
	"provider" varchar(50) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"status" varchar(20) NOT NULL,
	"http_status" integer,
	"request_payload" jsonb,
	"response_payload" jsonb,
	"error_message" text,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "atlas_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"run_id" uuid,
	"author_id" uuid,
	"author_label" varchar(100),
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "atlas_role_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"preset_code" varchar(50) NOT NULL,
	"label" varchar(255) NOT NULL,
	"department" varchar(100),
	"entitlements" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "atlas_role_templates_preset_code_unique" UNIQUE("preset_code")
);
--> statement-breakpoint
CREATE TABLE "atlas_workflow_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_code" varchar(30) NOT NULL,
	"employee_id" uuid NOT NULL,
	"type" "atlas_workflow_type" NOT NULL,
	"status" "atlas_workflow_status" DEFAULT 'pending' NOT NULL,
	"owner_id" uuid,
	"owner_label" varchar(100),
	"risk_note" text,
	"payload" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "atlas_workflow_runs_run_code_unique" UNIQUE("run_code")
);
--> statement-breakpoint
CREATE TABLE "atlas_workflow_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"step_key" varchar(100) NOT NULL,
	"phase" varchar(50),
	"title" varchar(255) NOT NULL,
	"status" "atlas_step_status" DEFAULT 'queued' NOT NULL,
	"is_manual" boolean DEFAULT false NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"input_payload" jsonb,
	"result_payload" jsonb,
	"error_message" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_approval_items" DROP CONSTRAINT "order_approval_items_order_item_id_order_items_id_fk";
--> statement-breakpoint
ALTER TABLE "order_approvals" ALTER COLUMN "order_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order_approval_items" ADD COLUMN "product_service" text;--> statement-breakpoint
ALTER TABLE "order_approval_items" ADD COLUMN "amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "order_approval_items" ADD COLUMN "qty" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "order_approval_items" ADD COLUMN "rate" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "order_approval_items" ADD COLUMN "negotiated_vendor_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "order_approval_items" ADD COLUMN "snapshot_date" timestamp;--> statement-breakpoint
ALTER TABLE "order_approvals" ADD COLUMN "vendor_approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "atlas_access_accounts" ADD CONSTRAINT "atlas_access_accounts_employee_id_atlas_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."atlas_employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_audit_logs" ADD CONSTRAINT "atlas_audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_email_deliveries" ADD CONSTRAINT "atlas_email_deliveries_run_id_atlas_workflow_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."atlas_workflow_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_email_deliveries" ADD CONSTRAINT "atlas_email_deliveries_employee_id_atlas_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."atlas_employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_email_deliveries" ADD CONSTRAINT "atlas_email_deliveries_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_employees" ADD CONSTRAINT "atlas_employees_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_integration_events" ADD CONSTRAINT "atlas_integration_events_run_id_atlas_workflow_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."atlas_workflow_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_integration_events" ADD CONSTRAINT "atlas_integration_events_step_id_atlas_workflow_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."atlas_workflow_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_notes" ADD CONSTRAINT "atlas_notes_employee_id_atlas_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."atlas_employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_notes" ADD CONSTRAINT "atlas_notes_run_id_atlas_workflow_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."atlas_workflow_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_notes" ADD CONSTRAINT "atlas_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_workflow_runs" ADD CONSTRAINT "atlas_workflow_runs_employee_id_atlas_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."atlas_employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_workflow_runs" ADD CONSTRAINT "atlas_workflow_runs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_workflow_steps" ADD CONSTRAINT "atlas_workflow_steps_run_id_atlas_workflow_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."atlas_workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "atlas_access_employee_id_idx" ON "atlas_access_accounts" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "atlas_audit_actor_id_idx" ON "atlas_audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "atlas_audit_entity_idx" ON "atlas_audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "atlas_audit_created_at_idx" ON "atlas_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "atlas_email_run_id_idx" ON "atlas_email_deliveries" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "atlas_email_employee_id_idx" ON "atlas_email_deliveries" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "atlas_email_status_idx" ON "atlas_email_deliveries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "atlas_employees_code_idx" ON "atlas_employees" USING btree ("employee_code");--> statement-breakpoint
CREATE INDEX "atlas_employees_dept_idx" ON "atlas_employees" USING btree ("department");--> statement-breakpoint
CREATE INDEX "atlas_int_events_run_id_idx" ON "atlas_integration_events" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "atlas_int_events_provider_idx" ON "atlas_integration_events" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "atlas_int_events_created_at_idx" ON "atlas_integration_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "atlas_notes_employee_id_idx" ON "atlas_notes" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "atlas_role_templates_code_idx" ON "atlas_role_templates" USING btree ("preset_code");--> statement-breakpoint
CREATE INDEX "atlas_runs_employee_id_idx" ON "atlas_workflow_runs" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "atlas_runs_status_idx" ON "atlas_workflow_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "atlas_runs_type_idx" ON "atlas_workflow_runs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "atlas_steps_run_id_idx" ON "atlas_workflow_steps" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "atlas_steps_status_idx" ON "atlas_workflow_steps" USING btree ("status");--> statement-breakpoint
CREATE INDEX "order_approval_items_snapshot_date_idx" ON "order_approval_items" USING btree ("snapshot_date");