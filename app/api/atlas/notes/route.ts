import { NextRequest, NextResponse } from 'next/server';
import { getNotes, saveNote } from '@/lib/atlas/queries';
import { requireAtlasAuth } from '@/lib/atlas/auth-guard';
import { SaveNoteSchema } from '@/lib/atlas/schemas';
import { logAudit } from '@/lib/atlas/audit';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;
  try {
    const employeeId = req.nextUrl.searchParams.get('employeeId');
    if (!employeeId) return NextResponse.json({ error: 'employeeId required' }, { status: 400 });
    const notes = await getNotes(employeeId);
    return NextResponse.json(notes);
  } catch (err) {
    console.error('[atlas/notes GET]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAtlasAuth();
  if (auth instanceof NextResponse) return auth;
  try {
    let body: z.infer<typeof SaveNoteSchema>;
    try { body = SaveNoteSchema.parse(await req.json()); }
    catch { return NextResponse.json({ error: 'Invalid input' }, { status: 400 }); }
    const authorLabel = auth.user.username ?? 'HR Admin';
    const note = await saveNote(body.employeeId, body.body.trim(), authorLabel, body.runId);
    await logAudit({
      actorId: auth.user.id,
      actorLabel: auth.user.username,
      action: 'note.add',
      entityType: 'note',
      entityId: note.id,
      detail: { employeeId: body.employeeId, runId: body.runId ?? null },
    });
    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    console.error('[atlas/notes POST]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
