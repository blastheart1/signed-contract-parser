import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const rows = await db
      .select({ id: users.id, username: users.username, role: users.role })
      .from(users)
      .where(eq(users.status, 'active'));
    return NextResponse.json(rows);
  } catch (err) {
    console.error('[atlas/users GET]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
