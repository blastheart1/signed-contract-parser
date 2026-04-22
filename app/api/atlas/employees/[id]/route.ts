import { NextRequest, NextResponse } from 'next/server';
import { getEmployeeProfile, archiveEmployee, restoreEmployee, updateEmployee } from '@/lib/atlas/queries';
import { requireAtlasAuth } from '@/lib/atlas/auth-guard';
import { logAudit } from '@/lib/atlas/audit';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;
  try {
    const profile = await getEmployeeProfile(params.id);
    if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(profile);
  } catch (err) {
    console.error('[atlas/employees/[id] GET]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json() as {
      action: 'archive' | 'restore' | 'update';
      firstName?: string;
      lastName?: string;
      personalEmail?: string;
      phone?: string;
      position?: string;
      department?: string;
      managerName?: string;
      location?: string;
      employmentType?: string;
    };
    if (body.action === 'archive') {
      await archiveEmployee(params.id);
      await logAudit({
        actorId: auth.user.id,
        actorLabel: auth.user.username,
        action: 'employee.archive',
        entityType: 'employee',
        entityId: params.id,
      });
    } else if (body.action === 'restore') {
      await restoreEmployee(params.id);
      await logAudit({
        actorId: auth.user.id,
        actorLabel: auth.user.username,
        action: 'employee.restore',
        entityType: 'employee',
        entityId: params.id,
      });
    } else if (body.action === 'update') {
      const { action: _action, ...fields } = body;
      await updateEmployee(params.id, fields);
      await logAudit({
        actorId: auth.user.id,
        actorLabel: auth.user.username,
        action: 'employee.update',
        entityType: 'employee',
        entityId: params.id,
        detail: fields,
      });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[atlas/employees/[id] PATCH]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
