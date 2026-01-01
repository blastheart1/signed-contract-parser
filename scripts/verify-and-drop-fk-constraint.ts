import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function verifyAndDropConstraint() {
  try {
    console.log('Checking for foreign key constraints on order_approval_items...');
    console.log('Database URL:', process.env.POSTGRES_URL ? 'Found' : 'Missing');
    
    // Query to find all foreign key constraints on order_approval_items
    const constraints = await sql`
      SELECT 
        conname as constraint_name,
        contype as constraint_type
      FROM pg_constraint 
      WHERE conrelid = 'order_approval_items'::regclass 
        AND contype = 'f'
        AND conname LIKE '%order_item%';
    `;
    
    console.log('Found constraints:', constraints.rows);
    
    // Drop the constraint if it exists
    console.log('\nAttempting to drop constraint: order_approval_items_order_item_id_order_items_id_fk');
    await sql`
      ALTER TABLE "order_approval_items" 
      DROP CONSTRAINT IF EXISTS "order_approval_items_order_item_id_order_items_id_fk";
    `;
    
    console.log('Constraint drop command executed.');
    
    // Verify it's gone
    const remainingConstraints = await sql`
      SELECT 
        conname as constraint_name,
        contype as constraint_type
      FROM pg_constraint 
      WHERE conrelid = 'order_approval_items'::regclass 
        AND contype = 'f'
        AND conname LIKE '%order_item%';
    `;
    
    console.log('\nRemaining constraints after drop:', remainingConstraints.rows);
    
    if (remainingConstraints.rows.length === 0) {
      console.log('\n✅ Success! Foreign key constraint has been removed.');
    } else {
      console.log('\n⚠️  Warning: Constraint may still exist. Check the output above.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verifyAndDropConstraint();

