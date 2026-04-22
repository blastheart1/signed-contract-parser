'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, UserPlus, Archive, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import type { EmployeeListRow } from '@/lib/atlas/queries';
import { Avatar, Pill } from '@/components/atlas';
import { ATLAS_C as C } from '@/lib/atlas/tokens';

const STATUS_PILL: Record<string, { variant: 'ok' | 'warn' | 'crit' | 'neutral' | 'info' | 'gold'; label: string }> = {
  'in-progress': { variant: 'info', label: 'In Progress' },
  'pending':     { variant: 'neutral', label: 'Pending' },
  'completed':   { variant: 'ok', label: 'Completed' },
  'blocked':     { variant: 'warn', label: 'Blocked' },
  'failed':      { variant: 'crit', label: 'Failed' },
};

const PAGE_SIZE = 50;

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<EmployeeListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [dept, setDept] = useState('All');
  const [page, setPage] = useState(1);
  const [departments, setDepartments] = useState<string[]>(['All']);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchEmployees = useCallback(
    async (opts: { search: string; dept: string; archived: boolean; page: number }) => {
      setLoading(true);
      try {
        const sp = new URLSearchParams();
        if (opts.archived) sp.set('archived', 'true');
        if (opts.search.trim()) sp.set('q', opts.search.trim());
        if (opts.dept !== 'All') sp.set('department', opts.dept);
        sp.set('page', String(opts.page));
        sp.set('limit', String(PAGE_SIZE));

        const res = await fetch(`/api/atlas/employees?${sp.toString()}`);
        const data = await res.json() as { employees: EmployeeListRow[]; total: number };
        setEmployees(Array.isArray(data.employees) ? data.employees : []);
        setTotal(data.total ?? 0);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Load departments once on mount (unfiltered first page)
  useEffect(() => {
    fetch('/api/atlas/employees?limit=200')
      .then((r) => r.json())
      .then((data: { employees: EmployeeListRow[] }) => {
        const s = new Set((data.employees ?? []).map((e) => e.department ?? '').filter(Boolean));
        setDepartments(['All', ...Array.from(s).sort()]);
      })
      .catch(() => {});
    fetchEmployees({ search: '', dept: 'All', archived: false, page: 1 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchEmployees({ search, dept, archived: showArchived, page: 1 });
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    setPage(1);
    fetchEmployees({ search, dept, archived: showArchived, page: 1 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dept, showArchived]);

  useEffect(() => {
    fetchEmployees({ search, dept, archived: showArchived, page });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function handleArchive(e: React.MouseEvent, emp: EmployeeListRow) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm(`Archive ${emp.name}? They will be hidden from active lists.`)) return;
    await fetch(`/api/atlas/employees/${emp.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'archive' }),
    });
    fetchEmployees({ search, dept, archived: showArchived, page });
  }

  async function handleRestore(e: React.MouseEvent, emp: EmployeeListRow) {
    e.preventDefault(); e.stopPropagation();
    await fetch(`/api/atlas/employees/${emp.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore' }),
    });
    fetchEmployees({ search, dept, archived: showArchived, page });
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = total > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const end = Math.min(page * PAGE_SIZE, total);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color: C.ink900 }}>Employees</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: C.ink500 }}>
            {total} {showArchived ? 'total' : 'active'} employee{total !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowArchived((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 6,
              border: `1px solid ${C.ink100}`, background: showArchived ? C.ink050 : C.paper0,
              fontSize: 12, color: C.ink500, cursor: 'pointer',
            }}
          >
            <Archive size={13} />
            {showArchived ? 'Hide archived' : 'Show archived'}
          </button>
          <button
            onClick={() => router.push('/atlas/intake')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, background: C.channel, color: '#fff',
              border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <UserPlus size={14} />
            New hire
          </button>
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
            placeholder="Search name, code…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: 13, color: C.ink900, background: 'transparent', width: '100%' }}
          />
        </div>
        <select
          value={dept} onChange={(e) => setDept(e.target.value)}
          style={{
            padding: '6px 12px', borderRadius: 6, border: `1px solid ${C.ink100}`,
            background: C.paper0, fontSize: 13, color: C.ink900, cursor: 'pointer',
          }}
        >
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: C.paper0, border: `1px solid ${C.ink100}`, borderRadius: 8, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: 32, textAlign: 'center', fontSize: 13, color: C.ink500 }}>Loading…</p>
        ) : employees.length === 0 ? (
          <p style={{ padding: 32, textAlign: 'center', fontSize: 13, color: C.ink500 }}>
            {total === 0 && !search.trim() && dept === 'All' ? 'No employees yet. Click "New hire" to add one.' : 'No employees match your filters.'}
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.paper1 }}>
                {['Employee', 'Position', 'Department', 'Start Date', 'Run Status', 'Actions'].map((h) => (
                  <th key={h} style={{
                    padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600,
                    color: C.ink500, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, i) => {
                const isArchived = !!emp.deletedAt;
                const sp = emp.activeRunStatus ? STATUS_PILL[emp.activeRunStatus] : null;
                return (
                  <tr
                    key={emp.id}
                    className="atlas-row"
                    onClick={() => router.push(`/atlas/employees/${emp.id}`)}
                    style={{
                      borderTop: `1px solid ${C.ink100}`,
                      background: isArchived ? '#FAFAFA' : i % 2 === 0 ? C.paper0 : 'transparent',
                      opacity: isArchived ? 0.65 : 1,
                      cursor: 'pointer',
                    }}
                  >
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={emp.name} size="md" />
                        <div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.ink900 }}>{emp.name}</p>
                          <p style={{ margin: 0, fontSize: 11, color: C.ink500 }}>
                            {emp.employeeCode} · {emp.companyEmail ?? '—'}
                          </p>
                        </div>
                        {isArchived && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: C.ink500, background: C.ink050, borderRadius: 4, padding: '2px 6px' }}>
                            ARCHIVED
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: C.ink800 }}>{emp.position ?? '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: C.ink800 }}>{emp.department ?? '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: C.ink500 }}>
                      {emp.startDate ? new Date(emp.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {sp ? <Pill variant={sp.variant} dot={false} size="sm">{sp.label}</Pill> : <span style={{ fontSize: 12, color: C.ink300 }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 14px' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {isArchived ? (
                          <button onClick={(e) => handleRestore(e, emp)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.ok, fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <RotateCcw size={12} /> Restore
                          </button>
                        ) : (
                          <button onClick={(e) => handleArchive(e, emp)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.ink500, fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Archive size={12} /> Archive
                          </button>
                        )}
                        {emp.activeRunId && (
                          <Link href={`/atlas/workflows/${emp.activeRunId}`} style={{ fontSize: 11, color: C.info, textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}>
                            Workflow →
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <span style={{ fontSize: 12, color: C.ink500 }}>
            {start}–{end} of {total}
          </span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{
                display: 'flex', alignItems: 'center', padding: '5px 10px', borderRadius: 6,
                border: `1px solid ${C.ink100}`, background: C.paper0, cursor: page <= 1 ? 'default' : 'pointer',
                opacity: page <= 1 ? 0.4 : 1, fontSize: 12, color: C.ink800,
              }}
            >
              <ChevronLeft size={13} />
              Prev
            </button>
            <span style={{ padding: '5px 12px', fontSize: 12, color: C.ink500 }}>
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              style={{
                display: 'flex', alignItems: 'center', padding: '5px 10px', borderRadius: 6,
                border: `1px solid ${C.ink100}`, background: C.paper0, cursor: page >= totalPages ? 'default' : 'pointer',
                opacity: page >= totalPages ? 0.4 : 1, fontSize: 12, color: C.ink800,
              }}
            >
              Next
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
