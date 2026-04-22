import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { atlasAuditLogs } from '@/lib/db/schema';
import { requireAtlasAuth } from '@/lib/atlas/auth-guard';

export async function GET(req: NextRequest) {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;
  try {
    const limitParam = req.nextUrl.searchParams.get('limit');
    const limit = Math.min(Math.max(parseInt(limitParam ?? '100', 10) || 100, 1), 500);

    const logs = await db
      .select()
      .from(atlasAuditLogs)
      .orderBy(desc(atlasAuditLogs.createdAt))
      .limit(limit);

    return NextResponse.json(logs);
  } catch (err) {
    console.error('[atlas/audit GET]', err);
    return NextResponse.json({ error: 'Failed to load audit logs' }, { status: 500 });
  }
}
