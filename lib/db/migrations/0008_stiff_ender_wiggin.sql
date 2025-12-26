ALTER TABLE "invoices" ADD COLUMN "linked_line_items" jsonb;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "vendor_name_1" varchar(255);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "vendor_percentage" numeric(10, 4);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "total_work_assigned_to_vendor" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "estimated_vendor_cost" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "total_amount_work_completed" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "vendor_billing_to_date" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "vendor_savings_deficit" numeric(15, 2);--> statement-breakpoint
CREATE INDEX "alert_acknowledgments_customer_id_idx" ON "alert_acknowledgments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "change_history_customer_id_idx" ON "change_history" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "change_history_order_id_idx" ON "change_history" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "change_history_changed_at_idx" ON "change_history" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "customers_deleted_at_idx" ON "customers" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "customers_updated_at_idx" ON "customers" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "customers_status_idx" ON "customers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_order_id_idx" ON "invoices" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "invoices_updated_at_idx" ON "invoices" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_customer_id_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");