import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import type { SessionUser } from '@/lib/auth/session';

export async function requireAtlasAuth(opts?: { requiredRoles?: string[] }): Promise<{ user: SessionUser } | NextResponse> {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (opts?.requiredRoles && !opts.requiredRoles.includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return { user };
}
