import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireAtlasAuth } from '@/lib/atlas/auth-guard';

export async function GET() {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;
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
