import { sql } from '@vercel/postgres';
import { drizzle } from 'drizzle-orm/vercel-postgres';
import { migrate } from 'drizzle-orm/vercel-postgres/migrator';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function runMigrations() {
  try {
    console.log('Starting database migrations...');
    console.log('Database URL:', process.env.POSTGRES_URL ? 'Found' : 'Missing');
    
    // For migrations, we don't need schema - just the connection
    const db = drizzle(sql);
    
    console.log('Running migrations from ./lib/db/migrations...');
    await migrate(db, { migrationsFolder: './lib/db/migrations' });
    
    console.log('Migrations completed successfully!');
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

runMigrations();
