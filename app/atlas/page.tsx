'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Filter,
  Search,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { EMPLOYEES } from '@/lib/atlas/data';
import type { WorkflowStatus, WorkflowType, Employee } from '@/lib/atlas/data';
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

function daysUntil(dateStr: string): number {
  const today = new Date('2026-04-22');
  const target = new Date(dateStr);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type FilterStatus = WorkflowStatus | 'all';
type TypeFilter = WorkflowType | 'both';

// Filter pill counts
function countByStatus(employees: Employee[], status: WorkflowStatus): number {
  return employees.filter((e) => e.status === status).length;
}

export default function AtlasDashboard() {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('both');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  const filtered = useMemo(() => {
    let list = EMPLOYEES;
    if (typeFilter !== 'both') list = list.filter((e) => e.type === typeFilter);
    if (statusFilter !== 'all') list = list.filter((e) => e.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.position.toLowerCase().includes(q) ||
          e.dept.toLowerCase().includes(q),
      );
    }
    return list;
  }, [typeFilter, statusFilter, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const attention = EMPLOYEES.filter((e) => e.status === 'blocked' || e.status === 'failed');
  const incoming = EMPLOYEES.filter((e) => {
    const d = daysUntil(e.startDate);
    return d >= 0 && d <= 14 && e.status === 'pending';
  });

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function toggleAll() {
    if (selected.size === pageItems.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pageItems.map((e) => e.id)));
    }
  }

  const filterPills: { label: string; value: FilterStatus; count: number }[] = [
    { label: 'All', value: 'all', count: EMPLOYEES.length },
    { label: 'In Progress', value: 'in-progress', count: countByStatus(EMPLOYEES, 'in-progress') },
    { label: 'Blocked', value: 'blocked', count: countByStatus(EMPLOYEES, 'blocked') },
    { label: 'Failed', value: 'failed', count: countByStatus(EMPLOYEES, 'failed') },
    { label: 'Pending', value: 'pending', count: countByStatus(EMPLOYEES, 'pending') },
    { label: 'Completed', value: 'completed', count: countByStatus(EMPLOYEES, 'completed') },
  ];

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
            value: '7',
            sub: '+2 this week',
            subColor: C.ok,
          },
          {
            label: 'Active offboardings',
            value: '2',
            sub: '1 pending device return',
            subColor: C.warn,
          },
          {
            label: 'Requires attention',
            value: '3',
            sub: '1 failed · 2 blocked',
            subColor: C.crit,
            valueColor: C.crit,
          },
          {
            label: 'Avg. time to productive',
            value: '4.2d',
            sub: '−0.6d vs prior 30d',
            subColor: C.ok,
          },
          {
            label: 'Workflow run success',
            value: '94.3%',
            sub: 'Last 100 runs · 6 retried',
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
            <p style={{ margin: 0, fontSize: 11, color: m.subColor }}>{m.sub}</p>
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
                  {pageItems.map((emp, i) => {
                    const d = daysUntil(emp.startDate);
                    return (
                      <tr
                        key={emp.id}
                        className="atlas-row"
                        onClick={() => router.push(`/atlas/employees/${emp.id}`)}
                        style={{
                          borderTop: `1px solid ${C.ink100}`,
                          background: i % 2 === 0 ? C.paper0 : 'transparent',
                        }}
                      >
                        <td
                          style={{ padding: '10px 12px' }}
                          onClick={(e) => { e.stopPropagation(); toggleSelect(emp.id); }}
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(emp.id)}
                            onChange={() => toggleSelect(emp.id)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        {/* Person */}
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Avatar name={emp.name} size="md" />
                            <div>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.ink900 }}>
                                {emp.name}
                              </p>
                              <p style={{ margin: 0, fontSize: 11, color: C.ink500 }}>
                                {emp.position} · {emp.dept}
                              </p>
                            </div>
                          </div>
                        </td>
                        {/* Status */}
                        <td style={{ padding: '10px 12px' }}>
                          <div>
                            <StatusPill status={emp.status} />
                            {emp.risk && (
                              <p style={{ margin: '3px 0 0', fontSize: 10, color: C.warn }}>{emp.risk}</p>
                            )}
                          </div>
                        </td>
                        {/* Progress */}
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ProgressBar
                              pct={(emp.progress / emp.totalSteps) * 100}
                              status={emp.status}
                            />
                            <span style={{ fontSize: 11, color: C.ink500, whiteSpace: 'nowrap' }}>
                              {emp.progress}/{emp.totalSteps}
                            </span>
                          </div>
                        </td>
                        {/* Start date */}
                        <td style={{ padding: '10px 12px' }}>
                          <p style={{ margin: 0, fontSize: 12, color: C.ink900 }}>{formatDate(emp.startDate)}</p>
                          <p style={{ margin: 0, fontSize: 10, color: d < 0 ? C.ink500 : C.info }}>
                            {d === 0 ? 'Today' : d > 0 ? `in ${d}d` : `${Math.abs(d)}d ago`}
                          </p>
                        </td>
                        {/* Owner */}
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 12, color: C.ink500 }}>{emp.owner}</span>
                        </td>
                        {/* Type */}
                        <td style={{ padding: '10px 12px' }}>
                          <Pill variant={emp.type === 'onboarding' ? 'ok' : 'gold'} dot={false}>
                            {emp.type === 'onboarding' ? 'Onboard' : 'Offboard'}
                          </Pill>
                        </td>
                        {/* Actions */}
                        <td style={{ padding: '10px 12px' }}>
                          <button
                            onClick={(e) => e.stopPropagation()}
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
                        No employees match your filters.
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
                {filtered.length} employee{filtered.length !== 1 ? 's' : ''}
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
                  <ChevronRight size={13} color={C.ink500} />
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
              {attention.map((emp) => (
                <div key={emp.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Avatar name={emp.name} size="sm" />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: C.ink900 }}>{emp.name}</p>
                      <p style={{ margin: 0, fontSize: 10, color: C.ink500 }}>{emp.position}</p>
                    </div>
                    <StatusPill status={emp.status} />
                  </div>
                  {emp.risk && (
                    <Banner
                      variant={emp.status === 'failed' ? 'crit' : 'warn'}
                      title={emp.risk}
                    />
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <Link
                      href={`/atlas/employees/${emp.id}`}
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
              {EMPLOYEES.filter((e) => {
                const d = daysUntil(e.startDate);
                return d >= 0 && d <= 14;
              })
                .sort((a, b) => daysUntil(a.startDate) - daysUntil(b.startDate))
                .map((emp) => {
                  const d = daysUntil(emp.startDate);
                  return (
                    <div
                      key={emp.id}
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
                          {new Date(emp.startDate).getDate()}
                        </p>
                        <p style={{ margin: 0, fontSize: 9, color: C.ink500, lineHeight: 1 }}>
                          {new Date(emp.startDate).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                        </p>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: C.ink900 }}>{emp.name}</p>
                        <p style={{ margin: 0, fontSize: 11, color: C.ink500 }}>{emp.position}</p>
                      </div>
                      <span style={{ fontSize: 11, color: C.info, fontWeight: 500 }}>
                        {d === 0 ? 'Today' : `in ${d}d`}
                      </span>
                    </div>
                  );
                })}
              {EMPLOYEES.filter((e) => {
                const d = daysUntil(e.startDate);
                return d >= 0 && d <= 14;
              }).length === 0 && (
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
