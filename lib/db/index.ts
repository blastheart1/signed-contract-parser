import { drizzle } from 'drizzle-orm/vercel-postgres';
import { sql } from '@vercel/postgres';
import * as schema from './schema';

// Initialize Drizzle with Vercel Postgres
export const db = drizzle(sql, { schema });

// Export schema for use in queries
// Re-export everything from schema to ensure all tables are accessible
export { schema };
export * from './schema';

