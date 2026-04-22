'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Shield } from 'lucide-react';

const C = {
  channel: '#232F47',
  gold:    '#D79A2B',
  ink900:  '#141A28',
  ink800:  '#232F47',
  ink500:  '#6B7690',
  ink300:  '#B7BECB',
  ink100:  '#E8EAF0',
  ink050:  '#F1F2F6',
  paper0:  '#FFFFFF',
  paper1:  '#FBF7EF',
  ok:      '#3E8E68',
  okBg:    '#EAF4EF',
  warn:    '#C47F18',
  warnBg:  '#FEF6E4',
  err:     '#B93232',
  errBg:   '#FDEAEA',
};

interface AuditLog {
  id: string;
  actor: string;
  actorId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  detail: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

function ActionBadge({ action }: { action: string }) {
  let bg = C.ink050;
  let color = C.ink800;

  if (action.includes('archive') || action.includes('remove') || action.includes('cancel')) {
    bg = C.errBg; color = C.err;
  } else if (action.includes('create') || action.includes('add')) {
    bg = C.okBg; color = C.ok;
  } else if (action.includes('restore') || action.includes('resume')) {
    bg = C.warnBg; color = C.warn;
  }

  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      fontFamily: 'monospace',
      background: bg,
      color,
    }}>
      {action}
    </span>
  );
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/atlas/audit?limit=100');
      if (!res.ok) throw new Error('Failed to load audit logs');
      const data = await res.json() as AuditLog[];
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <Shield size={20} color={C.gold} />
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.ink900 }}>
          Audit Log
        </h1>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.ink500 }}>
          Last 100 entries
        </span>
        <button
          onClick={fetchLogs}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: `1px solid ${C.ink300}`,
            background: C.paper0,
            fontSize: 12,
            color: C.ink800,
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      <div style={{
        background: C.paper0,
        border: `1px solid ${C.ink100}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        {loading && (
          <div style={{ padding: 48, textAlign: 'center', color: C.ink500, fontSize: 14 }}>
            Loading audit logs…
          </div>
        )}
        {!loading && error && (
          <div style={{ padding: 48, textAlign: 'center', color: C.err, fontSize: 14 }}>
            {error}
          </div>
        )}
        {!loading && !error && logs.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: C.ink500, fontSize: 14 }}>
            No audit entries yet.
          </div>
        )}
        {!loading && !error && logs.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.ink050, borderBottom: `1px solid ${C.ink100}` }}>
                {['Timestamp', 'Actor', 'Action', 'Entity Type', 'Entity ID', 'Detail'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 14px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: C.ink500,
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr
                  key={log.id}
                  style={{
                    borderBottom: i < logs.length - 1 ? `1px solid ${C.ink100}` : undefined,
                    background: i % 2 === 0 ? C.paper0 : C.ink050,
                  }}
                >
                  <td style={{ padding: '10px 14px', color: C.ink500, whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 11 }}>
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 14px', color: C.ink800, fontWeight: 500 }}>
                    {log.actor}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <ActionBadge action={log.action} />
                  </td>
                  <td style={{ padding: '10px 14px', color: C.ink500 }}>
                    {log.entityType ?? '—'}
                  </td>
                  <td style={{ padding: '10px 14px', color: C.ink500, fontFamily: 'monospace', fontSize: 11 }}>
                    {log.entityId ? log.entityId.slice(0, 8) + '…' : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', color: C.ink500, maxWidth: 280 }}>
                    {log.detail ? (
                      <span style={{
                        display: 'inline-block',
                        maxWidth: 260,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontFamily: 'monospace',
                        fontSize: 11,
                      }}>
                        {JSON.stringify(log.detail)}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
