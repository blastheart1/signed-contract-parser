import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/permissions';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    
    if (!user || !isAdmin(user)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const preferenceType = searchParams.get('type'); // 'note', 'todo', 'maintenance', or null for all

    let preferences;
    if (preferenceType) {
      preferences = await db
        .select()
        .from(schema.adminPreferences)
        .where(
          and(
            eq(schema.adminPreferences.userId, user.id),
            eq(schema.adminPreferences.preferenceType, preferenceType)
          )
        )
        .orderBy(desc(schema.adminPreferences.createdAt));
    } else {
      preferences = await db
        .select()
        .from(schema.adminPreferences)
        .where(eq(schema.adminPreferences.userId, user.id))
        .orderBy(desc(schema.adminPreferences.createdAt));
    }

    return NextResponse.json({ success: true, preferences });
  } catch (error) {
    console.error('Error fetching admin preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferences', message: error instanceof Error ? error.message : 'Unknown error' },
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
    const { preferenceType, title, content, metadata } = body;

    if (!preferenceType || !['note', 'todo', 'maintenance'].includes(preferenceType)) {
      return NextResponse.json(
        { error: 'Invalid preference type. Must be: note, todo, or maintenance' },
        { status: 400 }
      );
    }

    const [preference] = await db
      .insert(schema.adminPreferences)
      .values({
        userId: user.id,
        preferenceType,
        title: title || null,
        content: content || null,
        metadata: metadata || null,
      })
      .returning();

    return NextResponse.json({ success: true, preference }, { status: 201 });
  } catch (error) {
    console.error('Error creating admin preference:', error);
    return NextResponse.json(
      { error: 'Failed to create preference', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

