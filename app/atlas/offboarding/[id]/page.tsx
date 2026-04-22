'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, ExternalLink, CheckSquare, Square } from 'lucide-react';
import { EMPLOYEES } from '@/lib/atlas/data';
import { Avatar, StatusPill, Pill, Banner, SysPill } from '@/components/atlas';

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
  paper3:   '#EFE8DA',
  ok:       '#3E8E68',
  okBg:     '#EAF4EF',
  warn:     '#C29327',
  warnBg:   '#FDF3DC',
  crit:     '#FE5834',
  critBg:   '#FDECEA',
  info:     '#466BA6',
};

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: C.paper0,
        border: `1px solid ${C.ink100}`,
        borderRadius: 8,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function PanelHeader({ title }: { title: string }) {
  return (
    <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.ink100}` }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.ink900 }}>{title}</p>
    </div>
  );
}

const SYSTEM_ACTIONS = [
  { sys: 'Google Workspace', action: 'Suspend account + transfer Drive ownership to manager', risk: false, status: 'Pending', checked: false },
  { sys: 'Dropbox', action: 'Revoke access + unlink personal device', risk: false, status: 'Pending', checked: false },
  { sys: 'Trello', action: 'Remove from all boards', risk: false, status: 'Executed', checked: true },
  { sys: 'Bill.com', action: 'Remove payment approval rights immediately', risk: true, status: 'Executed', checked: true },
  { sys: 'QuickBooks', action: 'Remove accounting access', risk: false, status: 'Executed', checked: true },
  { sys: 'Trainual', action: 'Archive account + preserve training record', risk: false, status: 'Executed', checked: true },
  { sys: 'Fleet App', action: 'Disable GPS tracking + remove device enrollment', risk: false, status: 'Pending', checked: false },
];

const DEPENDENCIES = [
  { label: 'Owned Trello cards', count: 4, action: 'Reassign' },
  { label: 'Shared Dropbox folders', count: 2, action: 'Transfer' },
  { label: 'Bill.com approval rules', count: 1, action: 'Update' },
  { label: 'Recurring calendar events', count: 7, action: 'Cancel or transfer' },
];

const APPROVALS = [
  { name: 'Alana Reeves', role: 'Manager', action: 'Approved offboarding', done: true },
  { name: 'Lena Park', role: 'HR', action: 'Confirmed last day', done: true },
  { name: 'Jo Bell', role: 'Finance', action: 'Final payroll approved', done: true },
];

const OFFBOARDING_STEPS = ['Approval', 'Effective date', 'System actions', 'Final review'];

export default function OffboardingPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const emp = EMPLOYEES.find((e) => e.id === id) ?? EMPLOYEES.find((e) => e.id === 'E-2133')!;

  const [checklist, setChecklist] = useState<boolean[]>(SYSTEM_ACTIONS.map((s) => s.checked));
  const activeStep = 2;

  function toggleCheck(i: number) {
    setChecklist((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Back */}
      <button
        onClick={() => router.push('/atlas')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 12,
          color: C.ink500,
          marginBottom: 16,
          padding: 0,
        }}
      >
        <ArrowLeft size={13} />
        Back to Queue
      </button>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <div>
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
            Offboarding
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Avatar name={emp.name} size="lg" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.ink900 }}>{emp.name}</h1>
                <Pill variant="gold" dot={false}>Offboarding</Pill>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: C.ink500 }}>
                {emp.position} · {emp.dept} · Last day: {emp.startDate}
              </p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              border: `1px solid ${C.ink100}`,
              background: C.paper0,
              color: C.ink800,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Save draft
          </button>
          <button
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              border: 'none',
              background: C.channel,
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Confirm &amp; execute
          </button>
        </div>
      </div>

      {/* Crit banner */}
      {emp.risk && (
        <div style={{ marginBottom: 16 }}>
          <Banner
            variant="crit"
            title={`Critical: ${emp.risk}`}
            body="All final payroll actions are on hold until device is returned and confirmed."
            actions={
              <>
                <button
                  style={{
                    padding: '5px 12px',
                    borderRadius: 5,
                    border: `1px solid ${C.crit}`,
                    background: C.paper0,
                    color: C.crit,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Hold payroll final
                </button>
                <button
                  style={{
                    padding: '5px 12px',
                    borderRadius: 5,
                    border: `1px solid ${C.ink100}`,
                    background: C.paper0,
                    color: C.ink500,
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  Acknowledge
                </button>
              </>
            }
          />
        </div>
      )}

      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
        {OFFBOARDING_STEPS.map((s, i) => {
          const done = i < activeStep;
          const active = i === activeStep;
          return (
            <React.Fragment key={s}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: done ? C.ok : active ? C.channel : C.paper2,
                    border: done ? 'none' : active ? 'none' : `2px solid ${C.ink300}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {done ? (
                    <Check size={12} color="#fff" strokeWidth={2.5} />
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, color: active ? '#fff' : C.ink500 }}>
                      {i + 1}
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    color: active ? C.ink900 : done ? C.ok : C.ink500,
                  }}
                >
                  {s}
                </span>
              </div>
              {i < OFFBOARDING_STEPS.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: i < activeStep ? C.ok : C.ink100,
                    margin: '0 12px',
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Two-col */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Main */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* System actions */}
          <Panel>
            <PanelHeader title="System actions" />
            <div>
              {SYSTEM_ACTIONS.map((s, i) => (
                <div
                  key={s.sys}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '11px 18px',
                    borderBottom: i < SYSTEM_ACTIONS.length - 1 ? `1px solid ${C.ink100}` : 'none',
                    background: s.risk ? '#FFF5F3' : 'transparent',
                  }}
                >
                  <button
                    onClick={() => toggleCheck(i)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
                  >
                    {checklist[i] ? (
                      <CheckSquare size={18} color={C.channel} />
                    ) : (
                      <Square size={18} color={C.ink300} />
                    )}
                  </button>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.ink900 }}>{s.sys}</p>
                    <p style={{ margin: '1px 0 0', fontSize: 12, color: C.ink500 }}>{s.action}</p>
                    {s.risk && (
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: C.crit, fontWeight: 500 }}>
                        ⚠ High risk — confirm before executing
                      </p>
                    )}
                  </div>
                  <Pill variant={s.status === 'Executed' ? 'ok' : 'neutral'} dot={false} size="sm">
                    {s.status}
                  </Pill>
                  <button
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: C.ink300,
                      padding: 2,
                    }}
                  >
                    <ExternalLink size={12} />
                  </button>
                </div>
              ))}
            </div>
          </Panel>

          {/* Dependencies */}
          <Panel>
            <PanelHeader title="Dependencies" />
            <div>
              {DEPENDENCIES.map((dep, i) => (
                <div
                  key={dep.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 18px',
                    borderBottom: i < DEPENDENCIES.length - 1 ? `1px solid ${C.ink100}` : 'none',
                  }}
                >
                  <div>
                    <span style={{ fontSize: 13, color: C.ink900, fontWeight: 500 }}>{dep.label}</span>
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        background: C.warnBg,
                        color: C.warn,
                        padding: '1px 6px',
                        borderRadius: 10,
                        fontWeight: 600,
                      }}
                    >
                      {dep.count}
                    </span>
                  </div>
                  <button
                    style={{
                      padding: '5px 12px',
                      borderRadius: 5,
                      border: `1px solid ${C.ink100}`,
                      background: C.paper0,
                      color: C.ink800,
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    {dep.action}
                  </button>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Aside */}
        <aside style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Approvals */}
          <Panel>
            <PanelHeader title="Approvals" />
            <div style={{ padding: 14 }}>
              {APPROVALS.map((a) => (
                <div
                  key={a.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    paddingBottom: 10,
                    marginBottom: 10,
                    borderBottom: `1px solid ${C.ink100}`,
                  }}
                >
                  <Avatar name={a.name} size="sm" />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: C.ink900 }}>{a.name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: C.ink500 }}>
                      {a.role} · {a.action}
                    </p>
                  </div>
                  <Check size={14} color={C.ok} />
                </div>
              ))}
            </div>
          </Panel>

          {/* Exit summary */}
          <Panel>
            <PanelHeader title="Exit summary" />
            <div style={{ padding: 14 }}>
              {[
                ['Last day', emp.startDate],
                ['Tenure', '2 years, 3 months'],
                ['Final payroll', 'On hold'],
                ['Device', 'Not returned'],
                ['Knowledge transfer', 'In progress'],
                ['Exit interview', 'Scheduled Apr 29'],
              ].map(([label, val]) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '6px 0',
                    borderBottom: `1px solid ${C.ink100}`,
                  }}
                >
                  <span style={{ fontSize: 12, color: C.ink500 }}>{label}</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color:
                        val === 'On hold' || val === 'Not returned'
                          ? C.crit
                          : C.ink900,
                    }}
                  >
                    {val}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
