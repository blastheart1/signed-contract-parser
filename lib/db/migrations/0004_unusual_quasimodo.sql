CREATE TABLE "backup_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"size" integer NOT NULL,
	"checksum" varchar(255) NOT NULL,
	"encrypted" boolean DEFAULT true NOT NULL,
	"status" varchar(50) DEFAULT 'completed' NOT NULL,
	"zapier_webhook_sent" boolean DEFAULT false,
	"zapier_webhook_sent_at" timestamp,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "backup_metadata" ADD CONSTRAINT "backup_metadata_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;