'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, RefreshCw, MessageCircle, Calendar, CheckCircle2 } from 'lucide-react';
import type { RunDetail } from '@/lib/atlas/data';
import { ACCESS_MATRIX_SYSTEMS } from '@/lib/atlas/data';
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

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/atlas/workflow-runs/${id}`)
      .then(async (res) => {
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const data = await res.json() as RunDetail;
        if (!cancelled) setRun(data);
      })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return <div style={{ padding: 32, color: C.ink500, fontSize: 13 }}>Loading…</div>;
  }

  if (notFound || !run) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.ink500 }}>
        Employee record not found.{' '}
        <button onClick={() => router.push('/atlas')} style={{ color: C.info, background: 'none', border: 'none', cursor: 'pointer' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const steps = run.steps ?? [];
  const events = run.events ?? [];
  const accessAccounts = run.accessAccounts ?? [];

  const sysEntries = ACCESS_MATRIX_SYSTEMS.map((label) => {
    const acc = accessAccounts.find((a) => a.system === label);
    return { label, status: acc?.status ?? null };
  });

  const phases = Array.from(new Set(steps.map((s) => s.phase ?? 'General')));
  const recentEvents = events.slice(0, 3);

  const tabs = [
    'Overview',
    `Timeline (${run.progress}/${run.totalSteps})`,
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
          <Avatar name={run.name} size="lg" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.ink900 }}>{run.name}</h1>
              <StatusPill status={run.status} size="md" />
              <Pill variant={run.type === 'onboarding' ? 'ok' : 'gold'} dot={false}>
                {run.type === 'onboarding' ? 'Onboarding' : 'Offboarding'}
              </Pill>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: C.ink500 }}>
              {run.employeeCode} · {run.position ?? '—'} · {run.department ?? '—'} · {run.location ?? '—'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="outline" onClick={() => alert(`Message feature coming soon.\nEmail: ${run.companyEmail ?? run.name}`)}>
            <MessageCircle size={13} />
            Message
          </Btn>
          <Btn variant="outline" onClick={() => alert('Calendar scheduling coming soon.')}>
            <Calendar size={13} />
            Schedule
          </Btn>
          <Btn variant="primary" onClick={() => router.push(`/atlas/workflows/${run.runId}`)}>Open workflow</Btn>
        </div>
      </div>

      {/* Risk banner */}
      {run.riskNote && (
        <div style={{ marginBottom: 16 }}>
          <Banner
            variant={run.status === 'failed' ? 'crit' : 'warn'}
            title={run.riskNote}
            actions={
              <>
                <Btn variant="crit" onClick={() => alert('Escalation flow: contact HR admin to flag this run for immediate review.')}>Escalate</Btn>
                <Btn variant="outline" onClick={async () => {
                  if (!confirm('Mark this risk note as resolved?')) return;
                  await fetch(`/api/atlas/workflow-runs/${run.runId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'resume' }),
                  });
                  router.refresh();
                }}>Resolve</Btn>
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
                  ['Company email', run.companyEmail ?? '—'],
                  ['Manager', run.managerName ?? '—'],
                  ['Start date', run.startDate ? new Date(run.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'],
                  ['Employment type', 'Full-time'],
                  ['Location', run.location ?? '—'],
                  ['Owner', run.ownerLabel ?? '—'],
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
                    onClick={() => alert('Re-sync triggered. Integration events will be replayed for this employee.')}
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
                    key={s.label}
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
                        title={`Open ${s.label}`}
                        onClick={() => alert(`Direct link to ${s.label} admin panel is not configured.\nSet the integration URL in Settings → Integrations.`)}
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
                {recentEvents.length === 0 ? (
                  <p style={{ padding: '12px 18px', fontSize: 12, color: C.ink500 }}>
                    No recent activity.
                  </p>
                ) : (
                  recentEvents.map((e, i) => (
                    <div
                      key={e.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '9px 18px',
                        borderBottom: i < recentEvents.length - 1 ? `1px solid ${C.ink100}` : 'none',
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: e.status === 'ok' ? C.ok : e.status === 'error' ? C.crit : C.info,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ flex: 1, fontSize: 13, color: C.ink900 }}>
                        {e.provider} / {e.eventType}
                      </span>
                      <span style={{ fontSize: 11, color: C.ink500 }}>
                        {new Date(e.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </div>

          {/* Aside */}
          <aside style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel>
              <PanelHeader title="Key people" />
              <div style={{ padding: 14 }}>
                {[
                  ['Hiring manager', run.managerName ?? 'Not set'],
                  ['HR Owner', 'HR'],
                  ['IT Owner', 'IT'],
                  ['Accounting', 'Finance'],
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
                <p style={{ margin: 0, fontSize: 12, color: C.ink500 }}>No approvals recorded yet.</p>
              </div>
            </Panel>
          </aside>
        </div>
      )}

      {/* ─── Timeline tab ─────────────────────────────────────────── */}
      {activeTab === 1 && (
        <Panel>
          {steps.length === 0 ? (
            <p style={{ padding: 18, fontSize: 13, color: C.ink500 }}>No steps created yet.</p>
          ) : (
            phases.map((phase) => {
              const phaseSteps = steps.filter((s) => (s.phase ?? 'General') === phase);
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
                    {phaseSteps.map((step, i) => {
                      const markerColor =
                        step.status === 'done'
                          ? C.ok
                          : step.status === 'blocked' || step.status === 'failed'
                          ? C.crit
                          : step.status === 'active'
                          ? C.channel
                          : C.ink300;
                      return (
                        <div
                          key={step.id}
                          style={{ display: 'flex', gap: 14, paddingBottom: 16, position: 'relative' }}
                        >
                          {i < phaseSteps.length - 1 && (
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
                            {step.status === 'done' && <CheckCircle2 size={10} color="#fff" />}
                          </div>
                          <div style={{ flex: 1, paddingTop: 2 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.ink900 }}>
                              {step.title}
                            </p>
                            {step.errorMessage && (
                              <p style={{ margin: '2px 0 0', fontSize: 12, color: C.crit }}>
                                {step.errorMessage}
                              </p>
                            )}
                          </div>
                          <Pill
                            variant={
                              step.status === 'done'
                                ? 'ok'
                                : step.status === 'active'
                                ? 'info'
                                : step.status === 'blocked' || step.status === 'failed'
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
            })
          )}
        </Panel>
      )}

      {/* ─── Access tab ───────────────────────────────────────────── */}
      {activeTab === 2 && (
        <Panel>
          <PanelHeader title="System Access" />
          <div>
            {sysEntries.map((s, i) => (
              <div
                key={s.label}
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
                    background:
                      s.status === 'provisioned' || s.status === 'invited' ? C.channel : C.ink300,
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
          <div style={{ padding: 18 }}>
            <p style={{ fontSize: 13, color: C.ink500, margin: 0 }}>No emails sent yet.</p>
          </div>
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
                  boxSizing: 'border-box',
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
