import { NextResponse } from 'next/server';
import { getRoleTemplates } from '@/lib/atlas/queries';
import { db } from '@/lib/db';
import { atlasRoleTemplates } from '@/lib/db/schema';

export async function GET() {
  try {
    const templates = await getRoleTemplates();
    return NextResponse.json(templates);
  } catch (err) {
    console.error('[atlas/role-templates GET]', err);
    return NextResponse.json({ error: 'Failed to load role templates' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as { label: string; department?: string; entitlements: Record<string, boolean> };
    const { label, department, entitlements } = body;

    if (!label || typeof label !== 'string') {
      return NextResponse.json({ error: 'label is required' }, { status: 400 });
    }

    const presetCode = label.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 30);

    const [created] = await db
      .insert(atlasRoleTemplates)
      .values({
        presetCode,
        label,
        department: department ?? null,
        entitlements,
        isActive: true,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('[atlas/role-templates POST]', err);
    return NextResponse.json({ error: 'Failed to create role template' }, { status: 500 });
  }
}
