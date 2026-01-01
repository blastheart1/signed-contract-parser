import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { getSession, hashPassword } from '@/lib/auth/session';
import { eq, and, ne } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export async function PATCH(request: NextRequest) {
  try {
    const user = await getSession();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { username, currentPassword, newPassword } = body;

    // Build update object
    const updateData: any = {
      updatedAt: new Date(),
    };

    // Update username if provided and different (vendors cannot change username)
    if (username !== undefined && username !== user.username) {
      if (user.role === 'vendor') {
        return NextResponse.json(
          { error: 'Vendors cannot change their username' },
          { status: 403 }
        );
      }

      // Check if username is already taken by another user
      const [existingUser] = await db
        .select()
        .from(schema.users)
        .where(and(
          eq(schema.users.username, username),
          ne(schema.users.id, user.id)
        ))
        .limit(1);

      if (existingUser) {
        return NextResponse.json(
          { error: 'Username already taken' },
          { status: 400 }
        );
      }

      updateData.username = username;
    }

    // Update password if provided
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required to change password' },
          { status: 400 }
        );
      }

      // Validate new password length
      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: 'New password must be at least 6 characters long' },
          { status: 400 }
        );
      }

      // Verify current password by fetching user and comparing
      const [dbUser] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, user.id))
        .limit(1);

      if (!dbUser) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, dbUser.passwordHash);
      if (!isValidPassword) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 401 }
        );
      }

      // Hash new password
      updateData.passwordHash = await hashPassword(newPassword);
    }

    // Only update if there are changes
    if (Object.keys(updateData).length === 1) {
      // Only updatedAt, no actual changes
      return NextResponse.json(
        { error: 'No changes to update' },
        { status: 400 }
      );
    }

    // Update user in database
    const [updatedUser] = await db
      .update(schema.users)
      .set(updateData)
      .where(eq(schema.users.id, user.id))
      .returning();

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Remove password hash from response
    const { passwordHash, ...safeUser } = updatedUser;

    return NextResponse.json({ 
      success: true, 
      user: safeUser 
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update profile', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

