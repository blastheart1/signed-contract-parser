import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { atlasEmployees } from '@/lib/db/schema';
import { count } from 'drizzle-orm';

export async function GET() {
  try {
    const [row] = await db.select({ count: count() }).from(atlasEmployees);
    return NextResponse.json({ count: Number(row?.count ?? 0) });
  } catch (err) {
    console.error('[atlas/employees/count GET]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
