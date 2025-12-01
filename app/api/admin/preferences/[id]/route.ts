import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/permissions';
import { eq, and } from 'drizzle-orm';

export async function PATCH(
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
    const { title, content, metadata } = body;

    // Verify the preference belongs to the current user
    const [existing] = await db
      .select()
      .from(schema.adminPreferences)
      .where(
        and(
          eq(schema.adminPreferences.id, params.id),
          eq(schema.adminPreferences.userId, user.id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Preference not found' },
        { status: 404 }
      );
    }

    const [updated] = await db
      .update(schema.adminPreferences)
      .set({
        title: title !== undefined ? title : existing.title,
        content: content !== undefined ? content : existing.content,
        metadata: metadata !== undefined ? metadata : existing.metadata,
        updatedAt: new Date(),
      })
      .where(eq(schema.adminPreferences.id, params.id))
      .returning();

    return NextResponse.json({ success: true, preference: updated });
  } catch (error) {
    console.error('Error updating admin preference:', error);
    return NextResponse.json(
      { error: 'Failed to update preference', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Verify the preference belongs to the current user
    const [existing] = await db
      .select()
      .from(schema.adminPreferences)
      .where(
        and(
          eq(schema.adminPreferences.id, params.id),
          eq(schema.adminPreferences.userId, user.id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Preference not found' },
        { status: 404 }
      );
    }

    await db
      .delete(schema.adminPreferences)
      .where(eq(schema.adminPreferences.id, params.id));

    return NextResponse.json({ success: true, message: 'Preference deleted' });
  } catch (error) {
    console.error('Error deleting admin preference:', error);
    return NextResponse.json(
      { error: 'Failed to delete preference', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

