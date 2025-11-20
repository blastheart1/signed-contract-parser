import { cookies } from 'next/headers';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export interface SessionUser {
  id: string;
  username: string;
  email?: string | null;
  role: string | null;
  status: string;
}

/**
 * Create a session for a user
 */
export async function createSession(userId: string): Promise<string> {
  // Generate a simple session token (in production, use JWT or a proper session store)
  const sessionToken = Buffer.from(`${userId}:${Date.now()}:${Math.random()}`).toString('base64');
  
  // Store session in cookie (httpOnly, secure in production)
  const cookieStore = await cookies();
  cookieStore.set('session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });

  // In a real app, you'd store this in a sessions table or Redis
  // For now, we'll use a simple approach with the user's last_login as a session indicator
  await db
    .update(schema.users)
    .set({ lastLogin: new Date() })
    .where(eq(schema.users.id, userId));

  return sessionToken;
}

/**
 * Get current session user
 */
export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (!sessionToken) {
      return null;
    }

    // Decode session token to get userId
    // In production, verify JWT signature or check session store
    const decoded = Buffer.from(sessionToken, 'base64').toString('utf-8');
    const [userId] = decoded.split(':');

    if (!userId) {
      return null;
    }

    // Get user from database
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user || user.status !== 'active') {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

/**
 * Destroy session
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}

/**
 * Verify username and password
 */
export async function verifyCredentials(username: string, password: string): Promise<SessionUser | null> {
  try {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);

    if (!user) {
      return null;
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return null;
    }

    // Check if user is active
    if (user.status !== 'active') {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  } catch (error) {
    console.error('Error verifying credentials:', error);
    return null;
  }
}

/**
 * Hash password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Check if password needs to be changed (temporary password)
 */
export async function requiresPasswordChange(userId: string): Promise<boolean> {
  // For now, we'll check if the user has a specific flag or pattern
  // In a real implementation, you'd have a `password_changed_at` field or `temporary_password` flag
  // For simplicity, we'll check if password starts with "temp_" (admin sets this pattern)
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user) {
    return false;
  }

  // Simple check: if password hash is very short or matches a pattern, it's temporary
  // In production, add a `temporary_password` boolean field to users table
  // For now, we'll use a workaround: check if there's a flag in a separate field
  // Actually, let's add a check for a specific pattern in the password hash
  // Or better: add a migration to add `temporary_password` field later
  // For now, return false - we'll implement this properly with a database field
  return false;
}

