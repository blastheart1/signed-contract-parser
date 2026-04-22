'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, XCircle, Play } from 'lucide-react';
import type { RunDetail } from '@/lib/atlas/data';
import { Avatar, StatusPill, Pill } from '@/components/atlas';

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
  warnBg:   '#FDF3DC',
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

function PanelHeader({ title }: { title: string }) {
  return (
    <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.ink100}` }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.ink900 }}>{title}</p>
    </div>
  );
}

const LVL_COLOR: Record<string, string> = {
  ok:    C.ok,
  warn:  C.warn,
  error: C.crit,
  info:  C.info,
};

type LogFilter = 'all' | 'warn' | 'error';

export default function WorkflowRunPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [logFilter, setLogFilter] = useState<LogFilter>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function runAction(action: 'retry' | 'cancel' | 'resume') {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/atlas/workflow-runs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error();
      const updated = await fetch(`/api/atlas/workflow-runs/${id}`).then(r => r.json());
      setRun(updated);
    } catch {
      alert(`Failed to ${action} run.`);
    } finally {
      setActionLoading(null);
    }
  }

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
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return <div style={{ padding: 32, color: C.ink500, fontSize: 13 }}>Loading…</div>;
  }

  if (notFound || !run) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: C.ink500, fontSize: 13 }}>
        Workflow not found.{' '}
        <button onClick={() => router.push('/atlas')} style={{ color: C.info, background: 'none', border: 'none', cursor: 'pointer' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const events = run.events ?? [];
  const steps = run.steps ?? [];

  const warnCount = events.filter((e) => e.status === 'warn').length;
  const errorCount = events.filter((e) => e.status === 'error').length;
  const totalRetries = steps.reduce((s, step) => s + step.retryCount, 0);
  const awaitingHuman = steps.filter((s) => s.isManual && s.status === 'active').length;

  const filteredEvents = events.filter((e) => {
    if (logFilter === 'warn') return e.status === 'warn';
    if (logFilter === 'error') return e.status === 'error';
    return true;
  });

  const payloadDisplay = {
    runId: run.runId,
    runCode: run.runCode,
    employeeId: run.employeeId,
    employeeCode: run.employeeCode,
    name: run.name,
    startDate: run.startDate,
    companyEmail: run.companyEmail,
    position: run.position,
    department: run.department,
    managerName: run.managerName,
    location: run.location,
    totalSteps: run.totalSteps,
  };

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 18,
                fontWeight: 700,
                color: C.ink900,
              }}
            >
              {run.runCode}
            </span>
            <StatusPill status={run.status} />
          </div>
          <p style={{ margin: 0, fontSize: 13, color: C.ink500 }}>
            {run.name} · {run.startedAt ? `Started ${new Date(run.startedAt).toLocaleString()}` : 'Not started'} · {events.length} events
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => runAction('retry')}
            disabled={actionLoading === 'retry'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '7px 12px',
              borderRadius: 6,
              border: `1px solid ${C.ink100}`,
              background: C.paper0,
              fontSize: 12,
              cursor: actionLoading === 'retry' ? 'wait' : 'pointer',
              color: C.ink800,
              opacity: actionLoading === 'retry' ? 0.6 : 1,
            }}
          >
            <RefreshCw size={12} />
            Retry failed
          </button>
          <button
            onClick={() => { if (confirm('Cancel this run?')) runAction('cancel'); }}
            disabled={actionLoading === 'cancel'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '7px 12px',
              borderRadius: 6,
              border: `1px solid ${C.crit}`,
              background: C.paper0,
              color: C.crit,
              fontSize: 12,
              cursor: actionLoading === 'cancel' ? 'wait' : 'pointer',
              opacity: actionLoading === 'cancel' ? 0.6 : 1,
            }}
          >
            <XCircle size={12} />
            Cancel run
          </button>
          <button
            onClick={() => runAction('resume')}
            disabled={actionLoading === 'resume'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '7px 14px',
              borderRadius: 6,
              border: 'none',
              background: C.channel,
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: actionLoading === 'resume' ? 'wait' : 'pointer',
              opacity: actionLoading === 'resume' ? 0.6 : 1,
            }}
          >
            <Play size={12} />
            Resume
          </button>
        </div>
      </div>

      {/* Metric band */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          background: C.paper0,
          border: `1px solid ${C.ink100}`,
          borderRadius: 8,
          marginBottom: 20,
          overflow: 'hidden',
        }}
      >
        {[
          { label: 'Steps', value: `${run.progress} / ${run.totalSteps}`, sub: 'completed', subColor: C.ink500 },
          { label: 'Retries', value: String(totalRetries), sub: 'auto-retried', subColor: totalRetries > 0 ? C.warn : C.ink500, valueColor: totalRetries > 0 ? C.warn : undefined },
          { label: 'Awaiting human', value: String(awaitingHuman), sub: 'manual steps', subColor: awaitingHuman > 0 ? C.info : C.ink500 },
          { label: 'Events', value: String(events.length), sub: `${warnCount} warn · ${errorCount} error`, subColor: C.ink500 },
        ].map((m, i) => (
          <div
            key={m.label}
            style={{
              padding: '14px 18px',
              borderRight: i < 3 ? `1px solid ${C.ink100}` : 'none',
            }}
          >
            <p style={{ margin: '0 0 3px', fontSize: 11, color: C.ink500, fontWeight: 500 }}>{m.label}</p>
            <p
              style={{
                margin: '0 0 2px',
                fontSize: 22,
                fontWeight: 700,
                color: m.valueColor ?? C.ink900,
                fontFamily: 'JetBrains Mono, monospace',
                lineHeight: 1.1,
              }}
            >
              {m.value}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: m.subColor }}>{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Two-col */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Main */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Event log */}
          <Panel>
            <div
              style={{
                padding: '12px 18px',
                borderBottom: `1px solid ${C.ink100}`,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.ink900, marginRight: 8 }}>
                Event log
              </p>
              {([['all', events.length], ['warn', warnCount], ['error', errorCount]] as const).map(
                ([filter, count]) => {
                  const active = logFilter === filter;
                  return (
                    <button
                      key={filter}
                      onClick={() => setLogFilter(filter)}
                      style={{
                        padding: '3px 9px',
                        borderRadius: 20,
                        border: `1px solid ${active ? C.channel : C.ink100}`,
                        background: active ? C.channel : C.paper0,
                        color: active ? '#fff' : C.ink500,
                        fontSize: 11,
                        fontWeight: active ? 600 : 400,
                        cursor: 'pointer',
                      }}
                    >
                      {filter === 'all' ? 'All' : filter === 'warn' ? 'Warnings' : 'Errors'} {count}
                    </button>
                  );
                },
              )}
            </div>
            <div
              style={{
                padding: '8px 0',
                maxHeight: 340,
                overflowY: 'auto',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {filteredEvents.length === 0 && (
                <p style={{ padding: '16px 18px', fontSize: 12, color: C.ink500 }}>
                  No events yet — workflow has not started.
                </p>
              )}
              {filteredEvents.map((entry, i) => (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '6px 18px',
                    background:
                      entry.status === 'warn'
                        ? C.warnBg
                        : entry.status === 'error'
                        ? '#FDECEA'
                        : 'transparent',
                    borderBottom: `1px solid ${C.ink100}`,
                    alignItems: 'flex-start',
                  }}
                >
                  <span style={{ fontSize: 11, color: C.ink500, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {new Date(entry.createdAt).toISOString().split('T')[1].replace('Z', '').slice(0, 8)}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: LVL_COLOR[entry.status] ?? C.ink500,
                      textTransform: 'uppercase',
                      width: 36,
                      flexShrink: 0,
                    }}
                  >
                    {entry.status}
                  </span>
                  <span style={{ fontSize: 12, color: C.ink900, flex: 1 }}>
                    {entry.provider} / {entry.eventType}
                    {entry.errorMessage ? ` — ${entry.errorMessage}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          {/* Steps by phase */}
          <Panel>
            <PanelHeader title="Workflow steps" />
            {steps.length === 0 ? (
              <p style={{ padding: '16px 18px', fontSize: 12, color: C.ink500 }}>
                No steps have been created for this workflow yet.
              </p>
            ) : (
              (() => {
                const phases = Array.from(new Set(steps.map((s) => s.phase ?? 'General')));
                return phases.map((phase) => {
                  const phaseSteps = steps.filter((s) => (s.phase ?? 'General') === phase);
                  return (
                    <div key={phase}>
                      <div style={{ padding: '8px 18px', background: C.paper1, borderBottom: `1px solid ${C.ink100}` }}>
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                          {phase}
                        </p>
                      </div>
                      {phaseSteps.map((s, i) => {
                        const stepVariant =
                          s.status === 'done' ? 'ok'
                          : s.status === 'active' ? 'info'
                          : s.status === 'blocked' || s.status === 'failed' ? 'crit'
                          : 'neutral';
                        return (
                          <div
                            key={s.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: '10px 18px',
                              borderBottom: i < phaseSteps.length - 1 ? `1px solid ${C.ink100}` : 'none',
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: C.ink900 }}>{s.title}</p>
                              {s.errorMessage && (
                                <p style={{ margin: '2px 0 0', fontSize: 11, color: C.crit }}>{s.errorMessage}</p>
                              )}
                            </div>
                            {s.retryCount > 0 && (
                              <span style={{ fontSize: 11, color: C.warn }}>{s.retryCount} retries</span>
                            )}
                            <Pill variant={stepVariant} size="sm">{s.status}</Pill>
                          </div>
                        );
                      })}
                    </div>
                  );
                });
              })()
            )}
          </Panel>
        </div>

        {/* Aside */}
        <aside style={{ width: 420, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Payload */}
          <Panel>
            <PanelHeader title="Payload" />
            <pre
              style={{
                margin: 0,
                padding: '14px 18px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                color: C.ink900,
                background: C.ink050,
                overflowX: 'auto',
                lineHeight: 1.6,
              }}
            >
              {JSON.stringify(payloadDisplay, null, 2)}
            </pre>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
