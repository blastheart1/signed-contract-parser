import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { hashPassword } from '@/lib/auth/session';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, email } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Validate password strength (minimum 6 characters)
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Check if username already exists
    const [existingUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 400 }
      );
    }

    // Check if email already exists (if provided)
    if (email) {
      const [existingEmail] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);

      if (existingEmail) {
        return NextResponse.json(
          { error: 'Email already registered' },
          { status: 400 }
        );
      }
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user with pending status (awaiting admin approval)
    const [newUser] = await db
      .insert(schema.users)
      .values({
        username,
        passwordHash,
        email: email || null,
        role: null, // No role assigned yet - admin will assign
        status: 'pending', // Pending approval
        salesRepName: null,
      })
      .returning();

    // Remove password hash from response
    const { passwordHash: _, ...safeUser } = newUser;

    return NextResponse.json(
      {
        success: true,
        message: 'Registration successful. Your account is pending admin approval.',
        user: safeUser,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error registering user:', error);
    return NextResponse.json(
      {
        error: 'Failed to register user',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

