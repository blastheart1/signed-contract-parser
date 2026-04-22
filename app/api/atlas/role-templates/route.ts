import { NextResponse } from 'next/server';
import { getRoleTemplates } from '@/lib/atlas/queries';
import { db } from '@/lib/db';
import { atlasRoleTemplates } from '@/lib/db/schema';
import { requireAtlasAuth } from '@/lib/atlas/auth-guard';
import { RoleTemplateSchema } from '@/lib/atlas/schemas';
import { logAudit } from '@/lib/atlas/audit';
import { z } from 'zod';

export async function GET() {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;
  try {
    const templates = await getRoleTemplates();
    return NextResponse.json(templates);
  } catch (err) {
    console.error('[atlas/role-templates GET]', err);
    return NextResponse.json({ error: 'Failed to load role templates' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;
  try {
    let body: z.infer<typeof RoleTemplateSchema>;
    try { body = RoleTemplateSchema.parse(await req.json()); }
    catch { return NextResponse.json({ error: 'Invalid input' }, { status: 400 }); }
    const { label, entitlements } = body;
    const department = undefined;

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

    await logAudit({
      actorId: auth.user.id,
      actorLabel: auth.user.username,
      action: 'role_template.create',
      entityType: 'role_template',
      entityId: created.id,
      detail: { presetCode, label },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('[atlas/role-templates POST]', err);
    return NextResponse.json({ error: 'Failed to create role template' }, { status: 500 });
  }
}
