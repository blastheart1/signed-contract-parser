import { NextRequest, NextResponse } from 'next/server';
import { getEmployeeList } from '@/lib/atlas/queries';
import { requireAtlasAuth } from '@/lib/atlas/auth-guard';

export async function GET(req: NextRequest) {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;
  try {
    const sp = req.nextUrl.searchParams;
    const includeArchived = sp.get('archived') === 'true';
    const search = sp.get('q') ?? undefined;
    const department = sp.get('department') ?? undefined;
    const page = sp.get('page') ? Number(sp.get('page')) : 1;
    const limit = sp.get('limit') ? Number(sp.get('limit')) : 50;

    const result = await getEmployeeList({ includeArchived, search, department, page, limit });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[atlas/employees GET]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
