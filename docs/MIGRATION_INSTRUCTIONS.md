# Alert Acknowledgments Table Migration

The `alert_acknowledgments` table exists in the migration file but needs to be created in production.

## Option 1: Run SQL Directly in Neon Console (Recommended)

1. Go to your Neon dashboard
2. Open the SQL Editor for your production database
3. Run this SQL:

```sql
CREATE TABLE "alert_acknowledgments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar(255) NOT NULL,
	"alert_type" varchar(50) NOT NULL,
	"acknowledged_by" uuid NOT NULL,
	"acknowledged_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "alert_acknowledgments_customer_id_alert_type_unique" UNIQUE("customer_id","alert_type")
);

ALTER TABLE "alert_acknowledgments" ADD CONSTRAINT "alert_acknowledgments_customer_id_customers_dbx_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("dbx_customer_id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "alert_acknowledgments" ADD CONSTRAINT "alert_acknowledgments_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "alert_acknowledgments_customer_id_idx" ON "alert_acknowledgments"("customer_id");
```

## Option 2: Run Migration Script with Production Environment

If you have access to production `POSTGRES_URL` environment variable:

1. Export production POSTGRES_URL:
   ```bash
   export POSTGRES_URL="your-production-postgres-url"
   ```

2. Run the migration:
   ```bash
   npm run migrate
   ```

**Note:** Be very careful with production database credentials. Only do this if you're certain about the environment.

## Option 3: Use Drizzle Kit Push (Alternative)

If you have production database access:

```bash
export POSTGRES_URL="your-production-postgres-url"
npm run db:push
```

## Verification

After running the migration, verify the table exists:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'alert_acknowledgments';
```

You should see the table listed.

## Important Notes

- The migration creates the table with all necessary constraints and indexes
- The table has a unique constraint on (customer_id, alert_type)
- Foreign keys reference customers and users tables
- Make sure the customers and users tables exist before running this migration
