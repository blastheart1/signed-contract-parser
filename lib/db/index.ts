import { drizzle } from 'drizzle-orm/vercel-postgres';
import { sql } from '@vercel/postgres';
import * as schema from './schema';

// Initialize Drizzle with Vercel Postgres
export const db = drizzle(sql, { schema });

// Export schema for use in queries
export { schema };

