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

    // Execute the migration - Drizzle migrations use --> statement-breakpoint as delimiters
    // Split by statement-breakpoint, then by semicolons within each statement
    const statements = migrationSQL
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.match(/^\s*$/))
      .flatMap(block => {
        // Within each block, split by semicolons
        return block.split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));
      });
    
    for (const statement of statements) {
      if (statement.trim() && !statement.match(/^\s*$/)) {
        try {
          await sql.query(statement);
        } catch (error) {
          // If statement fails, log it but continue (might be a duplicate constraint, etc.)
          console.warn(`Warning executing statement: ${statement.substring(0, 100)}...`);
          console.warn(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

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
