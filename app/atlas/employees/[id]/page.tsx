'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, RefreshCw, MessageCircle, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  EMPLOYEES,
  TIMELINE_TEMPLATE,
  ACCESS_MATRIX_SYSTEMS,
} from '@/lib/atlas/data';
import type { SystemStatus } from '@/lib/atlas/data';
import { Avatar, StatusPill, SysPill, Banner, Pill } from '@/components/atlas';

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
  okBg:     '#EAF4EF',
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
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function PanelHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '12px 18px',
        borderBottom: `1px solid ${C.ink100}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.ink900 }}>{title}</p>
      {action}
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

function Btn({
  children,
  variant = 'outline',
  onClick,
}: {
  children: React.ReactNode;
  variant?: 'outline' | 'primary' | 'ghost' | 'crit';
  onClick?: () => void;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: C.channel, color: '#fff', border: 'none' },
    outline: { background: C.paper0, color: C.ink800, border: `1px solid ${C.ink100}` },
    ghost: { background: 'transparent', color: C.ink500, border: 'none' },
    crit: { background: C.paper0, color: C.crit, border: `1px solid ${C.crit}` },
  };
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

const SYSTEM_KEYS: Array<{ key: keyof ReturnType<typeof EMPLOYEES[0]['systems']['gmail'] extends infer T ? () => T : never>; label: string }> = [
  { key: 'gmail' as never, label: 'Google Workspace' },
  { key: 'dropbox' as never, label: 'Dropbox' },
  { key: 'trello' as never, label: 'Trello' },
  { key: 'billcom' as never, label: 'Bill.com' },
  { key: 'quickbooks' as never, label: 'QuickBooks' },
  { key: 'trainual' as never, label: 'Trainual' },
  { key: 'fleet' as never, label: 'Fleet App' },
];

const RECENT_ACTIVITY = [
  { ts: '2026-04-22 08:05', msg: 'Trainual invite accepted', lvl: 'ok' },
  { ts: '2026-04-22 08:03', msg: 'Dropbox access granted', lvl: 'ok' },
  { ts: '2026-04-22 08:01', msg: 'Google Workspace provisioned', lvl: 'ok' },
  { ts: '2026-04-22 08:00', msg: 'Onboarding workflow initiated', lvl: 'info' },
];

const COMMS = [
  { template: 'offer-letter', subject: 'Welcome to Calimingo Pools!', delivery: 'via Docusign', status: 'delivered' as const },
  { template: 'day1-invite', subject: 'Day-1 Schedule & Details', delivery: 'via Gmail', status: 'delivered' as const },
  { template: 'system-access', subject: 'Your Calimingo Accounts Are Ready', delivery: 'via Gmail', status: 'delivered' as const },
  { template: 'manager-intro', subject: 'Meet Derek Hollis, Your Manager', delivery: 'via Gmail', status: 'pending' as const },
];

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const emp = EMPLOYEES.find((e) => e.id === id);
  const [activeTab, setActiveTab] = useState(0);
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState<string[]>([]);

  if (!emp) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.ink500 }}>
        Employee {id} not found.{' '}
        <button onClick={() => router.push('/atlas')} style={{ color: C.info, background: 'none', border: 'none', cursor: 'pointer' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const sysEntries: { key: string; label: string; status: SystemStatus }[] = [
    { key: 'gmail', label: 'Google Workspace', status: emp.systems.gmail },
    { key: 'dropbox', label: 'Dropbox', status: emp.systems.dropbox },
    { key: 'trello', label: 'Trello', status: emp.systems.trello },
    { key: 'billcom', label: 'Bill.com', status: emp.systems.billcom },
    { key: 'quickbooks', label: 'QuickBooks', status: emp.systems.quickbooks },
    { key: 'trainual', label: 'Trainual', status: emp.systems.trainual },
    { key: 'fleet', label: 'Fleet App', status: emp.systems.fleet ?? null },
  ];

  const phases = ['Pre-boarding', 'Orientation', 'Enablement'] as const;

  const tabs = [
    'Overview',
    `Timeline (${emp.progress}/${emp.totalSteps})`,
    'Access',
    'Communications',
    'Notes',
  ];

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

      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <Avatar name={emp.name} size="lg" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.ink900 }}>{emp.name}</h1>
              <StatusPill status={emp.status} size="md" />
              <Pill variant={emp.type === 'onboarding' ? 'ok' : 'gold'} dot={false}>
                {emp.type === 'onboarding' ? 'Onboarding' : 'Offboarding'}
              </Pill>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: C.ink500 }}>
              {emp.id} · {emp.position} · {emp.dept} · {emp.location}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="outline">
            <MessageCircle size={13} />
            Message
          </Btn>
          <Btn variant="outline">
            <Calendar size={13} />
            Schedule
          </Btn>
          <Btn variant="primary">Open workflow</Btn>
        </div>
      </div>

      {/* Risk banner */}
      {emp.risk && (
        <div style={{ marginBottom: 16 }}>
          <Banner
            variant={emp.status === 'failed' ? 'crit' : 'warn'}
            title={emp.risk}
            actions={
              <>
                <Btn variant="crit">Escalate</Btn>
                <Btn variant="outline">Resolve</Btn>
              </>
            }
          />
        </div>
      )}

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: `1px solid ${C.ink100}`,
          marginBottom: 20,
          gap: 0,
        }}
      >
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === i ? 600 : 400,
              color: activeTab === i ? C.ink900 : C.ink500,
              borderBottom: activeTab === i ? `2px solid ${C.channel}` : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ─── Overview tab ─────────────────────────────────────────── */}
      {activeTab === 0 && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          {/* Main */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Profile panel */}
            <Panel>
              <PanelHeader title="Profile" />
              <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px 20px' }}>
                {[
                  ['Company email', `${emp.name.toLowerCase().replace(' ', '.')}@calimingo.com`],
                  ['Manager', emp.manager],
                  ['Start date', emp.startDate],
                  ['Employment type', 'Full-time'],
                  ['Location', emp.location],
                  ['Owner', emp.owner],
                ].map(([label, val]) => (
                  <div key={label}>
                    <p style={{ margin: 0, fontSize: 11, color: C.ink500, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {label}
                    </p>
                    <p style={{ margin: '3px 0 0', fontSize: 13, color: C.ink900 }}>{val}</p>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Account status */}
            <Panel>
              <PanelHeader
                title="Account status"
                action={
                  <button
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 12,
                      color: C.info,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <RefreshCw size={12} />
                    Re-sync
                  </button>
                }
              />
              <div>
                {sysEntries.map((s, i) => (
                  <div
                    key={s.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 18px',
                      borderBottom: i < sysEntries.length - 1 ? `1px solid ${C.ink100}` : 'none',
                    }}
                  >
                    <span style={{ fontSize: 13, color: C.ink900 }}>{s.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <SysPill status={s.status} />
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
                  </div>
                ))}
              </div>
            </Panel>

            {/* Recent activity */}
            <Panel>
              <PanelHeader title="Recent activity" />
              <div>
                {RECENT_ACTIVITY.map((a, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 18px',
                      borderBottom: i < RECENT_ACTIVITY.length - 1 ? `1px solid ${C.ink100}` : 'none',
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: a.lvl === 'ok' ? C.ok : C.info,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ flex: 1, fontSize: 13, color: C.ink900 }}>{a.msg}</span>
                    <span style={{ fontSize: 11, color: C.ink500 }}>{a.ts}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* Aside */}
          <aside style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel>
              <PanelHeader title="Key people" />
              <div style={{ padding: 14 }}>
                {[
                  ['Hiring manager', emp.manager],
                  ['HR owner', 'Lena Park'],
                  ['IT owner', 'Vic Kaur'],
                  ['Accounting', 'Jo Bell'],
                ].map(([role, name]) => (
                  <div
                    key={role}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '6px 0',
                    }}
                  >
                    <Avatar name={name as string} size="sm" />
                    <div>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: C.ink900 }}>{name}</p>
                      <p style={{ margin: 0, fontSize: 10, color: C.ink500 }}>{role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Approvals" />
              <div style={{ padding: 14 }}>
                {[
                  { name: 'Derek Hollis', action: 'Signed offer', status: 'done' },
                  { name: 'Lena Park', action: 'Approved hire', status: 'done' },
                  { name: 'Kate Hollister', action: 'Finance approval', status: 'awaiting' },
                ].map((a) => (
                  <div
                    key={a.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 0',
                    }}
                  >
                    {a.status === 'done' ? (
                      <CheckCircle2 size={14} color={C.ok} />
                    ) : (
                      <AlertCircle size={14} color={C.warn} />
                    )}
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: C.ink900 }}>{a.name}</p>
                      <p style={{ margin: 0, fontSize: 11, color: C.ink500 }}>{a.action}</p>
                    </div>
                    <Pill variant={a.status === 'done' ? 'ok' : 'warn'} size="sm">
                      {a.status === 'done' ? 'Done' : 'Awaiting'}
                    </Pill>
                  </div>
                ))}
              </div>
            </Panel>
          </aside>
        </div>
      )}

      {/* ─── Timeline tab ─────────────────────────────────────────── */}
      {activeTab === 1 && (
        <Panel>
          {phases.map((phase) => {
            const steps = TIMELINE_TEMPLATE.filter((s) => s.phase === phase);
            return (
              <div key={phase}>
                <div
                  style={{
                    padding: '10px 18px',
                    background: C.paper1,
                    borderBottom: `1px solid ${C.ink100}`,
                  }}
                >
                  <Eyebrow>{phase}</Eyebrow>
                </div>
                <div style={{ padding: '8px 18px' }}>
                  {steps.map((step, i) => {
                    const markerColor =
                      step.status === 'done'
                        ? C.ok
                        : step.status === 'blocked'
                        ? C.crit
                        : step.status === 'active'
                        ? C.channel
                        : C.ink300;
                    return (
                      <div
                        key={step.id}
                        style={{ display: 'flex', gap: 14, paddingBottom: 16, position: 'relative' }}
                      >
                        {/* Vertical line */}
                        {i < steps.length - 1 && (
                          <div
                            style={{
                              position: 'absolute',
                              left: 9,
                              top: 20,
                              bottom: 0,
                              width: 1,
                              background: C.ink100,
                            }}
                          />
                        )}
                        {/* Marker */}
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            background: step.status === 'done' ? markerColor : C.paper0,
                            border: `2px solid ${markerColor}`,
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1,
                          }}
                        >
                          {step.status === 'done' && (
                            <CheckCircle2 size={10} color="#fff" />
                          )}
                        </div>
                        <div style={{ flex: 1, paddingTop: 2 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.ink900 }}>
                            {step.title}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: C.ink500 }}>
                            {step.description}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: C.ink300 }}>
                            {step.assignee} ·{' '}
                            {step.daysFromStart === 0
                              ? 'Start day'
                              : step.daysFromStart > 0
                              ? `Day +${step.daysFromStart}`
                              : `Day ${step.daysFromStart}`}
                          </p>
                        </div>
                        <Pill
                          variant={
                            step.status === 'done'
                              ? 'ok'
                              : step.status === 'active'
                              ? 'info'
                              : step.status === 'blocked'
                              ? 'crit'
                              : 'neutral'
                          }
                          size="sm"
                        >
                          {step.status}
                        </Pill>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </Panel>
      )}

      {/* ─── Access tab ───────────────────────────────────────────── */}
      {activeTab === 2 && (
        <Panel>
          <PanelHeader title="System Access" />
          <div>
            {sysEntries.map((s, i) => (
              <div
                key={s.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 18px',
                  borderBottom: i < sysEntries.length - 1 ? `1px solid ${C.ink100}` : 'none',
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.ink900 }}>{s.label}</p>
                  <SysPill status={s.status} />
                </div>
                <div
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    background: s.status === 'provisioned' || s.status === 'invited' ? C.channel : C.ink300,
                    position: 'relative',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: '#fff',
                      position: 'absolute',
                      top: 3,
                      left:
                        s.status === 'provisioned' || s.status === 'invited'
                          ? 22
                          : 3,
                      transition: 'left 0.2s',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ─── Communications tab ───────────────────────────────────── */}
      {activeTab === 3 && (
        <Panel>
          <PanelHeader title="Communications" />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.paper1 }}>
                {['Template', 'Subject', 'Delivery', 'Status'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '8px 18px',
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: C.ink500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMMS.map((c, i) => (
                <tr
                  key={c.template}
                  style={{
                    borderTop: `1px solid ${C.ink100}`,
                    background: i % 2 === 0 ? C.paper0 : C.paper1,
                  }}
                >
                  <td style={{ padding: '10px 18px', fontSize: 12, color: C.ink500, fontFamily: 'JetBrains Mono, monospace' }}>
                    {c.template}
                  </td>
                  <td style={{ padding: '10px 18px', fontSize: 13, color: C.ink900 }}>{c.subject}</td>
                  <td style={{ padding: '10px 18px', fontSize: 12, color: C.ink500 }}>{c.delivery}</td>
                  <td style={{ padding: '10px 18px' }}>
                    <Pill variant={c.status === 'delivered' ? 'ok' : 'neutral'} size="sm">
                      {c.status}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {/* ─── Notes tab ────────────────────────────────────────────── */}
      {activeTab === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel>
            <PanelHeader title="Add note" />
            <div style={{ padding: 18 }}>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note about this employee…"
                style={{
                  width: '100%',
                  minHeight: 80,
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: `1px solid ${C.ink100}`,
                  fontSize: 13,
                  color: C.ink900,
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'Poppins, sans-serif',
                }}
              />
              <button
                onClick={() => {
                  if (note.trim()) {
                    setNotes((prev) => [note, ...prev]);
                    setNote('');
                  }
                }}
                style={{
                  marginTop: 8,
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: C.channel,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Save note
              </button>
            </div>
          </Panel>
          {notes.length > 0 && (
            <Panel>
              <PanelHeader title="Notes" />
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {notes.map((n, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 12px',
                      background: C.paper1,
                      borderRadius: 6,
                      fontSize: 13,
                      color: C.ink900,
                    }}
                  >
                    {n}
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
