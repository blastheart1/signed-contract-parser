'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserMinus } from 'lucide-react';
import { toast } from 'sonner';

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
  crit:     '#FE5834',
};

interface EmployeeRow {
  id: string;
  employeeCode: string;
  name: string;
  position: string | null;
  department: string | null;
  companyEmail: string | null;
  activeRunStatus: string | null;
  activeRunId: string | null;
  deletedAt: string | null;
}

export default function OffboardingListPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/atlas/employees')
      .then(async (res) => {
        const data = await res.json() as EmployeeRow[];
        if (!cancelled) {
          // Show only active (non-archived) employees who are not already being offboarded
          const candidates = data.filter(
            (e) =>
              !e.deletedAt &&
              !(
                e.activeRunStatus === 'pending' ||
                e.activeRunStatus === 'in-progress' ||
                e.activeRunStatus === 'blocked'
              ),
          );
          setEmployees(candidates);
        }
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load employees.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function handleStartOffboarding(employeeId: string) {
    setStarting(employeeId);
    setConfirmId(null);
    try {
      const res = await fetch('/api/atlas/offboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        toast.error(err.error ?? 'Failed to start offboarding.');
        return;
      }
      const { runId } = await res.json() as { runId: string };
      toast.success('Offboarding run started.');
      router.push(`/atlas/offboarding/${runId}`);
    } catch {
      toast.error('Failed to start offboarding.');
    } finally {
      setStarting(null);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <p
          style={{
            margin: '0 0 4px',
            fontFamily: 'Oswald, sans-serif',
            fontSize: 11,
            fontWeight: 600,
            color: C.gold,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}
        >
          Workflows
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <UserMinus size={22} color={C.ink800} />
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.ink900 }}>
            Offboarding
          </h1>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: C.ink500 }}>
          Select an employee to begin the offboarding workflow.
        </p>
      </div>

      {/* Table card */}
      <div
        style={{
          background: C.paper0,
          border: `1px solid ${C.ink100}`,
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {/* Table header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 140px',
            padding: '10px 18px',
            borderBottom: `1px solid ${C.ink100}`,
            background: C.ink050,
          }}
        >
          {['Employee', 'Position', 'Department', ''].map((h) => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, color: C.ink500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {h}
            </span>
          ))}
        </div>

        {loading ? (
          <p style={{ padding: 24, fontSize: 13, color: C.ink500, margin: 0 }}>Loading…</p>
        ) : employees.length === 0 ? (
          <p style={{ padding: 24, fontSize: 13, color: C.ink500, margin: 0 }}>
            No active employees available for offboarding.
          </p>
        ) : (
          employees.map((emp, i) => (
            <div
              key={emp.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 140px',
                alignItems: 'center',
                padding: '12px 18px',
                borderBottom: i < employees.length - 1 ? `1px solid ${C.ink100}` : 'none',
                background: C.paper0,
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.ink900 }}>{emp.name}</p>
                <p style={{ margin: '1px 0 0', fontSize: 11, color: C.ink500 }}>{emp.companyEmail ?? emp.employeeCode}</p>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: C.ink800 }}>{emp.position ?? '—'}</p>
              <p style={{ margin: 0, fontSize: 13, color: C.ink800 }}>{emp.department ?? '—'}</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                {confirmId === emp.id ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => handleStartOffboarding(emp.id)}
                      disabled={starting === emp.id}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 5,
                        border: 'none',
                        background: C.crit,
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: starting === emp.id ? 'wait' : 'pointer',
                        opacity: starting === emp.id ? 0.6 : 1,
                      }}
                    >
                      {starting === emp.id ? 'Starting…' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 5,
                        border: `1px solid ${C.ink100}`,
                        background: C.paper0,
                        color: C.ink500,
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(emp.id)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 5,
                      border: `1px solid ${C.ink300}`,
                      background: C.paper0,
                      color: C.ink800,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Start offboarding
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
