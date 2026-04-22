'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import type { DashboardRow } from '@/lib/atlas/data';
import { Avatar, Pill, StatusPill, ProgressBar, SkeletonTable } from '@/components/atlas';
import { ATLAS_C as C } from '@/lib/atlas/tokens';

const STATUS_OPTIONS = ['All', 'in-progress', 'blocked', 'failed', 'completed', 'pending'] as const;
type FilterStatus = typeof STATUS_OPTIONS[number];

const STATUS_LABELS: Record<string, string> = {
  'in-progress': 'In Progress',
  blocked: 'Blocked',
  failed: 'Failed',
  completed: 'Completed',
  pending: 'Pending',
};

export default function WorkflowsPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<DashboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('All');

  useEffect(() => {
    setLoading(true);
    fetch('/api/atlas/workflow-runs')
      .then((r) => r.json())
      .then((data) => setRuns(Array.isArray(data) ? data : []))
      .catch(() => setRuns([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = runs;
    if (statusFilter !== 'All') list = list.filter((r) => r.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.runCode.toLowerCase().includes(q),
      );
    }
    return list;
  }, [runs, search, statusFilter]);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color: C.ink900 }}>Workflows</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: C.ink500 }}>
            {filtered.length} workflow run{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, background: C.paper0,
          border: `1px solid ${C.ink100}`, borderRadius: 6, padding: '6px 10px', flex: 1,
        }}>
          <Search size={13} color={C.ink500} />
          <input
            placeholder="Search name or run code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: 13, color: C.ink900, background: 'transparent', width: '100%' }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
          style={{
            padding: '6px 12px', borderRadius: 6, border: `1px solid ${C.ink100}`,
            background: C.paper0, fontSize: 13, color: C.ink900, cursor: 'pointer',
          }}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === 'All' ? 'All Statuses' : STATUS_LABELS[s] ?? s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: C.paper0, border: `1px solid ${C.ink100}`, borderRadius: 8, overflow: 'hidden' }}>
        {loading ? (
          <SkeletonTable rows={6} />
        ) : filtered.length === 0 ? (
          <p style={{ padding: 32, textAlign: 'center', fontSize: 13, color: C.ink500 }}>
            {runs.length === 0 ? 'No workflow runs found.' : 'No runs match your filters.'}
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.paper1 }}>
                {['Run Code', 'Employee', 'Type', 'Status', 'Progress', 'Start Date', 'Actions'].map((h) => (
                  <th key={h} style={{
                    padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600,
                    color: C.ink500, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((run, i) => (
                <tr
                  key={run.runId}
                  className="atlas-row"
                  onClick={() => router.push(`/atlas/workflows/${run.runId}`)}
                  style={{
                    borderTop: `1px solid ${C.ink100}`,
                    background: i % 2 === 0 ? C.paper0 : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: C.ink800 }}>
                    {run.runCode}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={run.name} size="sm" />
                      <span style={{ fontSize: 13, color: C.ink900 }}>{run.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <Pill variant="neutral" dot={false} size="sm">
                      {run.type === 'onboarding' ? 'Onboard' : 'Offboard'}
                    </Pill>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <StatusPill status={run.status} />
                  </td>
                  <td style={{ padding: '10px 14px', minWidth: 120 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ProgressBar
                        pct={run.totalSteps > 0 ? Math.round((run.progress / run.totalSteps) * 100) : 0}
                        status={run.status}
                      />
                      <span style={{ fontSize: 11, color: C.ink500, whiteSpace: 'nowrap' }}>
                        {run.progress}/{run.totalSteps}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: C.ink500 }}>
                    {run.startedAt
                      ? new Date(run.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => router.push(`/atlas/workflows/${run.runId}`)}
                      style={{
                        border: 'none', background: 'none', cursor: 'pointer',
                        color: C.info, fontSize: 11,
                      }}
                    >
                      View →
                    </button>
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
