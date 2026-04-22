import { NextResponse } from 'next/server';
import { getRoleTemplates } from '@/lib/atlas/queries';

export async function GET() {
  try {
    const templates = await getRoleTemplates();
    return NextResponse.json(templates);
  } catch (err) {
    console.error('[atlas/role-templates GET]', err);
    return NextResponse.json({ error: 'Failed to load role templates' }, { status: 500 });
  }
}
