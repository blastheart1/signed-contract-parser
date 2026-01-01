import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function makeOrderIdNullable() {
  try {
    console.log('Making order_id nullable in order_approvals table...');
    console.log('Database URL:', process.env.POSTGRES_URL ? 'Found' : 'Missing');

    // Step 1: Drop the foreign key constraint
    console.log('Dropping foreign key constraint...');
    try {
      await sql.query(`
        ALTER TABLE "order_approvals" 
        DROP CONSTRAINT IF EXISTS "order_approvals_order_id_orders_id_fk";
      `);
      console.log('✓ Foreign key constraint dropped');
    } catch (error) {
      console.log('Note: Foreign key constraint may not exist or already dropped');
    }

    // Step 2: Make order_id nullable
    console.log('Making order_id nullable...');
    await sql.query(`
      ALTER TABLE "order_approvals" 
      ALTER COLUMN "order_id" DROP NOT NULL;
    `);
    console.log('✓ order_id is now nullable');

    // Step 3: Re-add the foreign key constraint (but allow NULL)
    console.log('Re-adding foreign key constraint (allowing NULL)...');
    try {
      await sql.query(`
        ALTER TABLE "order_approvals" 
        ADD CONSTRAINT "order_approvals_order_id_orders_id_fk" 
        FOREIGN KEY ("order_id") 
        REFERENCES "public"."orders"("id") 
        ON DELETE no action 
        ON UPDATE no action;
      `);
      console.log('✓ Foreign key constraint re-added');
    } catch (error) {
      console.log('Note: Foreign key constraint may already exist');
    }

    // Verify
    const checkNullable = await sql`
      SELECT is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'order_approvals' 
      AND column_name = 'order_id';
    `;
    
    if (checkNullable.rows.length > 0) {
      const isNullable = checkNullable.rows[0]?.is_nullable === 'YES';
      console.log(`\n✓ Verification: order_id nullable = ${isNullable}`);
      if (isNullable) {
        console.log('✓ Success! order_id is now nullable');
      } else {
        console.log('✗ Error: order_id is still NOT NULL');
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    process.exit(1);
  }
}

makeOrderIdNullable();

