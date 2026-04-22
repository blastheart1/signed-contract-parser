import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { atlasEmployees } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireAtlasAuth } from '@/lib/atlas/auth-guard';
import { decryptSalary } from '@/lib/atlas/crypto';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;
  try {
    const rows = await db
      .select({ salaryEncrypted: atlasEmployees.salaryEncrypted, compVisibility: atlasEmployees.compVisibility })
      .from(atlasEmployees)
      .where(eq(atlasEmployees.id, params.id))
      .limit(1);

    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { salaryEncrypted, compVisibility } = rows[0];
    const salary = salaryEncrypted ? decryptSalary(salaryEncrypted) : null;

    return NextResponse.json({ salary, visibility: compVisibility ?? 'restricted' });
  } catch (err) {
    console.error('[atlas/employees/[id]/compensation GET]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
