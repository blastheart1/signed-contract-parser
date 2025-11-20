/**
 * Script to create the first admin user
 * Run with: npm run create-admin
 */

import * as dotenv from 'dotenv';
import { db, schema } from '../lib/db';
import { hashPassword } from '../lib/auth/session';
import { eq } from 'drizzle-orm';
import * as readline from 'readline';

// Load environment variables
dotenv.config({ path: '.env.local' });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function createAdmin() {
  try {
    console.log('Creating admin user...\n');

    const username = await question('Enter username: ');
    if (!username) {
      console.error('Username is required');
      process.exit(1);
    }

    // Check if user already exists
    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);

    if (existing) {
      console.error(`User "${username}" already exists`);
      process.exit(1);
    }

    const password = await question('Enter password: ');
    if (!password) {
      console.error('Password is required');
      process.exit(1);
    }

    const email = await question('Enter email (optional): ');

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create admin user
    const [user] = await db
      .insert(schema.users)
      .values({
        username,
        passwordHash,
        email: email || null,
        role: 'admin',
        status: 'active',
      })
      .returning();

    console.log('\n✅ Admin user created successfully!');
    console.log(`Username: ${user.username}`);
    console.log(`Role: ${user.role}`);
    console.log(`Status: ${user.status}`);
    console.log('\nYou can now login at /login');

    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

createAdmin();

