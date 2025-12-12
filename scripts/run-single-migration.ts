import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function runSingleMigration() {
  try {
    const migrationFile = process.argv[2];
    if (!migrationFile) {
      console.error('Usage: tsx scripts/run-single-migration.ts <migration-file>');
      console.error('Example: tsx scripts/run-single-migration.ts 0008_add_linked_line_items_to_invoices.sql');
      process.exit(1);
    }

    console.log(`Running migration: ${migrationFile}`);
    console.log('Database URL:', process.env.POSTGRES_URL ? 'Found' : 'Missing');

    // Read the migration file
    const migrationPath = join(process.cwd(), 'lib/db/migrations', migrationFile);
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('Migration SQL:');
    console.log(migrationSQL);

    // Execute the migration
    await sql.unsafe(migrationSQL);

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    process.exit(1);
  }
}

runSingleMigration();
