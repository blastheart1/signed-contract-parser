import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function verifyTable() {
  try {
    console.log('Checking if reference_number_sequence table exists...');
    console.log('Database URL:', process.env.POSTGRES_URL ? 'Found' : 'Missing');

    // Check if table exists
    const checkResult = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'reference_number_sequence'
      ) as table_exists;
    `;

    const tableExists = checkResult.rows[0]?.table_exists;

    if (tableExists) {
      console.log('✓ Table reference_number_sequence exists');
      
      // Check if order_approvals table exists
      const checkApprovals = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'order_approvals'
        ) as table_exists;
      `;
      
      console.log(`✓ Table order_approvals exists: ${checkApprovals.rows[0]?.table_exists}`);
      
      // Check if order_id is nullable
      const checkNullable = await sql`
        SELECT is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'order_approvals' 
        AND column_name = 'order_id';
      `;
      
      if (checkNullable.rows.length > 0) {
        console.log(`✓ order_id nullable: ${checkNullable.rows[0]?.is_nullable === 'YES'}`);
      }
    } else {
      console.log('✗ Table reference_number_sequence does NOT exist');
      console.log('Creating table...');
      
      // Create the table directly
      await sql.query(`
        CREATE TABLE IF NOT EXISTS "reference_number_sequence" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "year" integer NOT NULL,
          "last_sequence" integer DEFAULT 0 NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL,
          CONSTRAINT "reference_number_sequence_year_unique" UNIQUE("year")
        );
      `);
      
      await sql.query(`
        CREATE INDEX IF NOT EXISTS "reference_number_sequence_year_idx" 
        ON "reference_number_sequence" USING btree ("year");
      `);
      
      console.log('✓ Table created successfully');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    process.exit(1);
  }
}

verifyTable();

