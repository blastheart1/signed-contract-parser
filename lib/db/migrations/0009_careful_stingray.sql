CREATE TYPE "public"."vendor_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"contact_person" varchar(255),
	"address" text,
	"city" varchar(100),
	"state" varchar(50),
	"zip" varchar(20),
	"category" varchar(100),
	"status" "vendor_status" DEFAULT 'active',
	"notes" text,
	"specialties" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "vendors_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE INDEX "vendors_name_idx" ON "vendors" USING btree ("name");--> statement-breakpoint
CREATE INDEX "vendors_status_idx" ON "vendors" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vendors_category_idx" ON "vendors" USING btree ("category");--> statement-breakpoint
CREATE INDEX "vendors_deleted_at_idx" ON "vendors" USING btree ("deleted_at");