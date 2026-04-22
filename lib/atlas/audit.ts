import { db } from '@/lib/db';
import { atlasAuditLogs } from '@/lib/db/schema';

export interface AuditEntry {
  actorId?: string | null;
  actorLabel?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  detail?: Record<string, unknown> | null;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const actor = entry.actorLabel ?? entry.actorId ?? 'System';
    await db.insert(atlasAuditLogs).values({
      actor,
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      detail: entry.detail ?? null,
      createdAt: new Date(),
    });
  } catch (err) {
    // Never let audit failure break the main operation
    console.error('[audit] Failed to write audit log:', err);
  }
}
