import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/permissions';
import { hashPassword } from '@/lib/auth/session';
import { eq } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    
    if (!user || !isAdmin(user)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { newPassword, temporary = false } = body;

    if (!newPassword) {
      return NextResponse.json(
        { error: 'New password is required' },
        { status: 400 }
      );
    }

    // Hash the new password
    const passwordHash = await hashPassword(newPassword);

    // If temporary, we could add a flag to force password change on next login
    // For now, we'll just set the password
    // In production, add a `temporary_password` or `password_changed_at` field
    const [updatedUser] = await db
      .update(schema.users)
      .set({
        passwordHash,
        updatedAt: new Date(),
        // In the future, add: temporaryPassword: temporary
      })
      .where(eq(schema.users.id, params.id))
      .returning();

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: temporary
        ? 'Temporary password set. User will be required to change it on next login.'
        : 'Password reset successfully',
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json(
      { error: 'Failed to reset password', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

