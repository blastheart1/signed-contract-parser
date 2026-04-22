'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { WorkflowStatus, WorkflowType, DashboardRow, DashboardMetrics } from '@/lib/atlas/data';
import { Avatar, StatusPill, ProgressBar, Pill, Banner } from '@/components/atlas';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  channel:  '#232F47',
  gold:     '#D79A2B',
  ink900:   '#141A28',
  ink800:   '#232F47',
  ink500:   '#6B7690',
  ink300:   '#B7BECB',
  ink100:   '#E8EAF0',
  ink050:   '#F1F2F6',
  paper0:   '#FFFFFF',
  paper1:   '#FBF7EF',
  paper2:   '#F8F1E7',
  ok:       '#3E8E68',
  warn:     '#C29327',
  crit:     '#FE5834',
  info:     '#466BA6',
};

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: C.paper0,
        border: `1px solid ${C.ink100}`,
        borderRadius: 8,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: 0,
        fontFamily: 'Oswald, sans-serif',
        fontSize: 11,
        fontWeight: 600,
        color: C.gold,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </p>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntilStr(dateStr: string | null): string {
  if (!dateStr) return '';
  const today = new Date();
  const target = new Date(dateStr);
  const d = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (d === 0) return 'Today';
  if (d > 0) return `in ${d}d`;
  return `${Math.abs(d)}d ago`;
}

function daysUntilNum(dateStr: string | null): number {
  if (!dateStr) return -9999;
  const today = new Date();
  return Math.round((new Date(dateStr).getTime() - today.getTime()) / 86400000);
}

type FilterStatus = WorkflowStatus | 'all';
type TypeFilter = WorkflowType | 'both';

function countByStatus(rows: DashboardRow[], status: WorkflowStatus): number {
  return rows.filter((r) => r.status === status).length;
}

const DEFAULT_METRICS: DashboardMetrics = {
  activeOnboardings: 0,
  activeOffboardings: 0,
  requiresAttention: 0,
  avgDaysToProductive: null,
  workflowSuccessRate: null,
};

export default function AtlasDashboard() {
  const router = useRouter();
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>(DEFAULT_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('both');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const PAGE_SIZE = 8;

  useEffect(() => {
    function closeMenu() { setOpenMenuId(null); }
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [rowsRes, metricsRes] = await Promise.all([
          fetch('/api/atlas/workflow-runs'),
          fetch('/api/atlas/metrics'),
        ]);
        if (!rowsRes.ok || !metricsRes.ok) throw new Error('API error');
        const [rowsData, metricsData] = await Promise.all([rowsRes.json(), metricsRes.json()]);
        if (!cancelled) {
          setRows(rowsData as DashboardRow[]);
          setMetrics(metricsData as DashboardMetrics);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    let list = rows;
    if (typeFilter !== 'both') list = list.filter((r) => r.type === typeFilter);
    if (statusFilter !== 'all') list = list.filter((r) => r.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.position ?? '').toLowerCase().includes(q) ||
          (r.department ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [rows, typeFilter, statusFilter, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const attention = rows.filter((r) => r.status === 'blocked' || r.status === 'failed');
  const incoming = rows.filter((r) => {
    const d = daysUntilNum(r.startDate);
    return d >= 0 && d <= 14;
  });

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function handleExport() {
    const toExport = rows.filter((r) => selected.has(r.runId));
    const headers = ['Name', 'Position', 'Department', 'Status', 'Type', 'Start Date', 'Progress'];
    const csvRows = [
      headers.join(','),
      ...toExport.map((r) => [
        `"${r.name}"`,
        `"${r.position ?? ''}"`,
        `"${r.department ?? ''}"`,
        r.status,
        r.type,
        r.startDate ?? '',
        `${r.progress}/${r.totalSteps}`,
      ].join(',')),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atlas-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleAll() {
    if (selected.size === pageItems.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pageItems.map((r) => r.runId)));
    }
  }

  const filterPills: { label: string; value: FilterStatus; count: number }[] = [
    { label: 'All',         value: 'all',         count: rows.length },
    { label: 'In Progress', value: 'in-progress',  count: countByStatus(rows, 'in-progress') },
    { label: 'Blocked',     value: 'blocked',      count: countByStatus(rows, 'blocked') },
    { label: 'Failed',      value: 'failed',       count: countByStatus(rows, 'failed') },
    { label: 'Pending',     value: 'pending',      count: countByStatus(rows, 'pending') },
    { label: 'Completed',   value: 'completed',    count: countByStatus(rows, 'completed') },
  ];

  if (loading) {
    return <div style={{ padding: 32, color: C.ink500, fontSize: 13 }}>Loading…</div>;
  }

  if (error) {
    return <div style={{ padding: 32, color: C.crit, fontSize: 13 }}>Failed to load data.</div>;
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: C.ink900,
          }}
        >
          Dashboard
        </h1>
        <button
          onClick={() => router.push('/atlas/intake')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: C.channel,
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 6,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Plus size={14} />
          New hire
        </button>
      </div>

      {/* ─── Metric band ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          background: C.paper0,
          border: `1px solid ${C.ink100}`,
          borderRadius: 8,
          marginBottom: 20,
          overflow: 'hidden',
        }}
      >
        {[
          {
            label: 'Active onboardings',
            value: String(metrics.activeOnboardings),
            sub: '',
            subColor: C.ok,
          },
          {
            label: 'Active offboardings',
            value: String(metrics.activeOffboardings),
            sub: '',
            subColor: C.warn,
          },
          {
            label: 'Requires attention',
            value: String(metrics.requiresAttention),
            sub: '',
            subColor: C.crit,
            valueColor: metrics.requiresAttention > 0 ? C.crit : undefined,
          },
          {
            label: 'Avg. time to productive',
            value: metrics.avgDaysToProductive != null ? `${metrics.avgDaysToProductive}d` : '—',
            sub: '',
            subColor: C.ok,
          },
          {
            label: 'Workflow run success',
            value: metrics.workflowSuccessRate != null ? `${metrics.workflowSuccessRate}%` : '—',
            sub: '',
            subColor: C.ink500,
          },
        ].map((m, i) => (
          <div
            key={m.label}
            style={{
              padding: '16px 18px',
              borderRight: i < 4 ? `1px solid ${C.ink100}` : 'none',
            }}
          >
            <p style={{ margin: '0 0 4px', fontSize: 11, color: C.ink500, fontWeight: 500 }}>{m.label}</p>
            <p
              style={{
                margin: '0 0 2px',
                fontSize: 24,
                fontWeight: 700,
                color: m.valueColor ?? C.ink900,
                lineHeight: 1.1,
              }}
            >
              {m.value}
            </p>
            {m.sub && <p style={{ margin: 0, fontSize: 11, color: m.subColor }}>{m.sub}</p>}
          </div>
        ))}
      </div>

      {/* ─── Two-column ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Main queue */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Panel>
            {/* Panel header */}
            <div
              style={{
                padding: '14px 18px 12px',
                borderBottom: `1px solid ${C.ink100}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <Eyebrow>Queue</Eyebrow>
                  <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 600, color: C.ink900 }}>
                    Everyone in motion
                  </p>
                </div>
                {/* Segmented control */}
                <div
                  style={{
                    display: 'flex',
                    background: C.ink050,
                    borderRadius: 6,
                    padding: 2,
                    gap: 2,
                  }}
                >
                  {(['both', 'onboarding', 'offboarding'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => { setTypeFilter(t); setPage(1); }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 4,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: typeFilter === t ? 600 : 400,
                        background: typeFilter === t ? C.paper0 : 'transparent',
                        color: typeFilter === t ? C.ink900 : C.ink500,
                        boxShadow: typeFilter === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      }}
                    >
                      {t === 'both' ? 'Both' : t === 'onboarding' ? 'Onboarding' : 'Offboarding'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' }}>
                  {filterPills.map((fp) => {
                    const active = statusFilter === fp.value;
                    return (
                      <button
                        key={fp.value}
                        onClick={() => { setStatusFilter(fp.value); setPage(1); }}
                        style={{
                          padding: '3px 9px',
                          borderRadius: 20,
                          border: `1px solid ${active ? C.channel : C.ink100}`,
                          background: active ? C.channel : C.paper0,
                          color: active ? '#FFFFFF' : C.ink500,
                          fontSize: 11,
                          fontWeight: active ? 600 : 400,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {fp.label}
                        <span
                          style={{
                            background: active ? 'rgba(255,255,255,0.2)' : C.ink050,
                            color: active ? '#fff' : C.ink500,
                            borderRadius: 10,
                            padding: '0 4px',
                            fontSize: 10,
                          }}
                        >
                          {fp.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    border: `1px solid ${C.ink100}`,
                    borderRadius: 6,
                    padding: '4px 8px',
                    background: C.paper0,
                  }}
                >
                  <Search size={12} color={C.ink500} />
                  <input
                    placeholder="Search…"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    style={{
                      border: 'none',
                      outline: 'none',
                      fontSize: 12,
                      color: C.ink900,
                      background: 'transparent',
                      width: 130,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Bulk action bar */}
            {selected.size > 0 && (
              <div
                style={{
                  padding: '8px 18px',
                  background: '#EEF1FF',
                  borderBottom: `1px solid ${C.ink100}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: C.ink800 }}>
                  {selected.size} selected
                </span>
                <button
                  onClick={handleExport}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 4,
                    border: `1px solid ${C.ink100}`,
                    background: C.paper0,
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  Export
                </button>
                <button
                  style={{
                    padding: '3px 10px',
                    borderRadius: 4,
                    border: 'none',
                    background: 'transparent',
                    fontSize: 11,
                    color: C.ink500,
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </button>
              </div>
            )}

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr
                    style={{
                      background: C.paper1,
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                    }}
                  >
                    <th style={{ width: 36, padding: '8px 12px' }}>
                      <input
                        type="checkbox"
                        checked={selected.size === pageItems.length && pageItems.length > 0}
                        onChange={toggleAll}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    {['Person', 'Status', 'Progress', 'Start date', 'Owner', 'Type', ''].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '8px 12px',
                          textAlign: 'left',
                          fontSize: 11,
                          fontWeight: 600,
                          color: C.ink500,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((row, i) => {
                    const dStr = daysUntilStr(row.startDate);
                    const dNum = daysUntilNum(row.startDate);
                    return (
                      <tr
                        key={row.runId}
                        className="atlas-row"
                        onClick={() => router.push(`/atlas/workflows/${row.runId}`)}
                        style={{
                          borderTop: `1px solid ${C.ink100}`,
                          background: i % 2 === 0 ? C.paper0 : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <td
                          style={{ padding: '10px 12px' }}
                          onClick={(e) => { e.stopPropagation(); toggleSelect(row.runId); }}
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(row.runId)}
                            onChange={() => toggleSelect(row.runId)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        {/* Person */}
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Avatar name={row.name} size="md" />
                            <div>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.ink900 }}>
                                {row.name}
                              </p>
                              <p style={{ margin: 0, fontSize: 11, color: C.ink500 }}>
                                {row.position ?? '—'} · {row.department ?? '—'}
                              </p>
                            </div>
                          </div>
                        </td>
                        {/* Status */}
                        <td style={{ padding: '10px 12px' }}>
                          <div>
                            <StatusPill status={row.status} />
                            {row.riskNote && (
                              <p style={{ margin: '3px 0 0', fontSize: 10, color: C.warn }}>{row.riskNote}</p>
                            )}
                          </div>
                        </td>
                        {/* Progress */}
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ProgressBar
                              pct={row.totalSteps > 0 ? (row.progress / row.totalSteps) * 100 : 0}
                              status={row.status}
                            />
                            <span style={{ fontSize: 11, color: C.ink500, whiteSpace: 'nowrap' }}>
                              {row.progress}/{row.totalSteps}
                            </span>
                          </div>
                        </td>
                        {/* Start date */}
                        <td style={{ padding: '10px 12px' }}>
                          <p style={{ margin: 0, fontSize: 12, color: C.ink900 }}>{formatDate(row.startDate)}</p>
                          <p style={{ margin: 0, fontSize: 10, color: dNum < 0 ? C.ink500 : C.info }}>
                            {dStr}
                          </p>
                        </td>
                        {/* Owner */}
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 12, color: C.ink500 }}>{row.ownerLabel ?? '—'}</span>
                        </td>
                        {/* Type */}
                        <td style={{ padding: '10px 12px' }}>
                          <Pill variant={row.type === 'onboarding' ? 'ok' : 'gold'} dot={false}>
                            {row.type === 'onboarding' ? 'Onboard' : 'Offboard'}
                          </Pill>
                        </td>
                        {/* Actions */}
                        <td style={{ padding: '10px 12px', position: 'relative' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === row.runId ? null : row.runId); }}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              padding: 2,
                              color: C.ink500,
                            }}
                          >
                            <MoreHorizontal size={14} />
                          </button>
                          {openMenuId === row.runId && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute',
                                right: 8,
                                top: '100%',
                                zIndex: 50,
                                background: C.paper0,
                                border: `1px solid ${C.ink100}`,
                                borderRadius: 6,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                minWidth: 140,
                                overflow: 'hidden',
                              }}
                            >
                              {[
                                { label: 'View run', action: () => router.push(`/atlas/workflows/${row.runId}`) },
                                { label: 'View employee', action: () => router.push(`/atlas/employees/${row.runId}`) },
                                { label: 'Cancel run', action: async () => {
                                  if (!confirm(`Cancel run for ${row.name}?`)) return;
                                  await fetch(`/api/atlas/workflow-runs/${row.runId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel' }) });
                                  setRows((prev) => prev.map((r) => r.runId === row.runId ? { ...r, status: 'failed' as const } : r));
                                  setOpenMenuId(null);
                                }},
                              ].map((item) => (
                                <button
                                  key={item.label}
                                  onClick={() => { item.action(); setOpenMenuId(null); }}
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '8px 14px',
                                    border: 'none',
                                    background: 'transparent',
                                    fontSize: 12,
                                    color: item.label === 'Cancel run' ? C.crit : C.ink800,
                                    cursor: 'pointer',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = C.ink050)}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {pageItems.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        style={{ padding: 32, textAlign: 'center', fontSize: 13, color: C.ink500 }}
                      >
                        {rows.length === 0
                          ? 'No active workflows. Click "New hire" to start one.'
                          : 'No workflows match your filters.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div
              style={{
                padding: '10px 18px',
                borderTop: `1px solid ${C.ink100}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 12, color: C.ink500 }}>
                {filtered.length} workflow{filtered.length !== 1 ? 's' : ''}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 4,
                    border: `1px solid ${C.ink100}`,
                    background: C.paper0,
                    cursor: page === 1 ? 'default' : 'pointer',
                    opacity: page === 1 ? 0.4 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ChevronLeft size={13} color={C.ink500} />
                </button>
                <span style={{ fontSize: 12, color: C.ink500, padding: '0 6px' }}>
                  {page} / {Math.max(1, totalPages)}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 4,
                    border: `1px solid ${C.ink100}`,
                    background: C.paper0,
                    cursor: page >= totalPages ? 'default' : 'pointer',
                    opacity: page >= totalPages ? 0.4 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ChevronLeft size={13} color={C.ink500} style={{ transform: 'rotate(180deg)' }} />
                </button>
              </div>
            </div>
          </Panel>
        </div>

        {/* ─── Aside ────────────────────────────────────────────────── */}
        <aside style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Attention panel */}
          <Panel>
            <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${C.ink100}` }}>
              <Eyebrow>Attention</Eyebrow>
              <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 600, color: C.ink900 }}>
                Needs review
              </p>
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {attention.map((row) => (
                <div key={row.runId}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Avatar name={row.name} size="sm" />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: C.ink900 }}>{row.name}</p>
                      <p style={{ margin: 0, fontSize: 10, color: C.ink500 }}>{row.position ?? '—'}</p>
                    </div>
                    <StatusPill status={row.status} />
                  </div>
                  {row.riskNote && (
                    <Banner
                      variant={row.status === 'failed' ? 'crit' : 'warn'}
                      title={row.riskNote}
                    />
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <Link
                      href={`/atlas/workflows/${row.runId}`}
                      style={{
                        flex: 1,
                        textAlign: 'center',
                        padding: '5px 0',
                        borderRadius: 5,
                        background: C.channel,
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      Open workflow
                    </Link>
                    <button
                      onClick={() => alert(`Snooze: ${row.name}'s alert will be hidden for 24 hours.`)}
                      style={{
                        flex: 1,
                        padding: '5px 0',
                        borderRadius: 5,
                        border: `1px solid ${C.ink100}`,
                        background: C.paper0,
                        color: C.ink500,
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      Snooze
                    </button>
                  </div>
                </div>
              ))}
              {attention.length === 0 && (
                <p style={{ fontSize: 12, color: C.ink500, textAlign: 'center', padding: 12 }}>
                  All clear — no items need review.
                </p>
              )}
            </div>
          </Panel>

          {/* Incoming panel */}
          <Panel>
            <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${C.ink100}` }}>
              <Eyebrow>Incoming</Eyebrow>
              <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 600, color: C.ink900 }}>
                Next 14 days
              </p>
            </div>
            <div style={{ padding: '8px 0' }}>
              {incoming
                .sort((a, b) => daysUntilNum(a.startDate) - daysUntilNum(b.startDate))
                .map((row) => {
                  const d = daysUntilNum(row.startDate);
                  const date = row.startDate ? new Date(row.startDate) : null;
                  return (
                    <div
                      key={row.runId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 16px',
                        borderBottom: `1px solid ${C.ink100}`,
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 6,
                          background: C.paper2,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.channel, lineHeight: 1 }}>
                          {date ? date.getDate() : '—'}
                        </p>
                        <p style={{ margin: 0, fontSize: 9, color: C.ink500, lineHeight: 1 }}>
                          {date
                            ? date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
                            : ''}
                        </p>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: C.ink900 }}>{row.name}</p>
                        <p style={{ margin: 0, fontSize: 11, color: C.ink500 }}>{row.position ?? '—'}</p>
                      </div>
                      <span style={{ fontSize: 11, color: C.info, fontWeight: 500 }}>
                        {d === 0 ? 'Today' : `in ${d}d`}
                      </span>
                    </div>
                  );
                })}
              {incoming.length === 0 && (
                <p style={{ fontSize: 12, color: C.ink500, textAlign: 'center', padding: 16 }}>
                  No upcoming start dates in the next 14 days.
                </p>
              )}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
