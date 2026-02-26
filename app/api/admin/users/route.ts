import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/permissions';
import { hashPassword } from '@/lib/auth/session';
import { eq, and, isNull, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    
    if (!user || !isAdmin(user)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const role = searchParams.get('role');

    // Apply filters
    let users;
    if (status && status !== 'all') {
      if (role && role !== 'all') {
        users = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.status, status as any))
          .then(rows => rows.filter(r => r.role === role));
      } else {
        users = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.status, status as any));
      }
    } else if (role && role !== 'all') {
      users = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.role, role as any));
    } else {
      users = await db.select().from(schema.users);
    }

    // Remove password hashes from response
    const safeUsers = users.map(({ passwordHash, ...user }) => user);

    return NextResponse.json({ success: true, users: safeUsers });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    
    if (!user || !isAdmin(user)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    let { username, password, email, role, status, salesRepName } = body;

    const emailTrimmed = typeof email === 'string' ? email.trim() : '';

    // Vendor role: email is required and must match an existing vendor in the Vendor List
    if (role === 'vendor') {
      if (!emailTrimmed) {
        return NextResponse.json(
          { error: 'Email is required for vendor users' },
          { status: 400 }
        );
      }
      const [vendorByEmail] = await db
        .select()
        .from(schema.vendors)
        .where(
          and(
            isNull(schema.vendors.deletedAt),
            sql`LOWER(TRIM(${schema.vendors.email})) = LOWER(${emailTrimmed})`
          )
        )
        .limit(1);
      if (!vendorByEmail) {
        return NextResponse.json(
          { error: 'Email must match an existing vendor in the Vendor List' },
          { status: 400 }
        );
      }
    }

    // For vendor users, use email as username by default if username is not provided
    if (role === 'vendor' && !username && emailTrimmed) {
      username = emailTrimmed;
    }

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
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

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const [newUser] = await db
      .insert(schema.users)
      .values({
        username,
        passwordHash,
        email: role === 'vendor' ? emailTrimmed : (email || null),
        role: role || null,
        status: status || 'pending',
        salesRepName: salesRepName || null,
      })
      .returning();

    // Remove password hash from response
    const { passwordHash: _, ...safeUser } = newUser;

    return NextResponse.json({ success: true, user: safeUser }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

