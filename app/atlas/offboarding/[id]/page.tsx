'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, ExternalLink, CheckSquare, Square } from 'lucide-react';
import type { RunDetail } from '@/lib/atlas/data';
import { Avatar, Pill, Banner, SysPill } from '@/components/atlas';

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

const OFFBOARDING_STEPS = ['Approval', 'Effective date', 'System actions', 'Final review'];

export default function OffboardingPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [checklist, setChecklist] = useState<boolean[]>([]);
  const activeStep = 2;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/atlas/workflow-runs/${id}`)
      .then(async (res) => {
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const data = await res.json() as RunDetail;
        if (!cancelled) {
          setRun(data);
          setChecklist(data.steps.map((s) => s.status === 'done'));
        }
      })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  function toggleCheck(i: number) {
    setChecklist((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  }

  if (loading) {
    return <div style={{ padding: 32, color: C.ink500, fontSize: 13 }}>Loading…</div>;
  }

  if (notFound || !run) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.ink500 }}>
        Offboarding record not found.{' '}
        <button onClick={() => router.push('/atlas')} style={{ color: C.info, background: 'none', border: 'none', cursor: 'pointer' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const steps = run.steps ?? [];
  const hasSteps = steps.length > 0;
  const lastDay = run.startDate
    ? new Date(run.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

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
            <Avatar name={run.name} size="lg" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.ink900 }}>{run.name}</h1>
                <Pill variant="gold" dot={false}>Offboarding</Pill>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: C.ink500 }}>
                {run.position ?? '—'} · {run.department ?? '—'} · Last day: {lastDay}
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
      {run.riskNote && (
        <div style={{ marginBottom: 16 }}>
          <Banner
            variant="crit"
            title={`Critical: ${run.riskNote}`}
            body="All final payroll actions are on hold until resolved."
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
          {/* System actions (from steps) */}
          <Panel>
            <PanelHeader title="System actions" />
            {!hasSteps ? (
              <p style={{ padding: 18, fontSize: 13, color: C.ink500, margin: 0 }}>
                No system actions defined yet.
              </p>
            ) : (
              <div>
                {steps.map((s, i) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '11px 18px',
                      borderBottom: i < steps.length - 1 ? `1px solid ${C.ink100}` : 'none',
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
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.ink900 }}>{s.title}</p>
                      {s.phase && (
                        <p style={{ margin: '1px 0 0', fontSize: 12, color: C.ink500 }}>{s.phase}</p>
                      )}
                    </div>
                    <Pill variant={s.status === 'done' ? 'ok' : 'neutral'} dot={false} size="sm">
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
            )}
          </Panel>
        </div>

        {/* Aside */}
        <aside style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Approvals */}
          <Panel>
            <PanelHeader title="Approvals" />
            <div style={{ padding: 14 }}>
              <p style={{ margin: 0, fontSize: 12, color: C.ink500 }}>No approvals recorded yet.</p>
            </div>
          </Panel>

          {/* Exit summary */}
          <Panel>
            <PanelHeader title="Exit summary" />
            <div style={{ padding: 14 }}>
              {[
                ['Last day', lastDay],
                ['Run code', run.runCode],
                ['Status', run.status],
                ['Department', run.department ?? '—'],
                ['Location', run.location ?? '—'],
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
                  <span style={{ fontSize: 12, fontWeight: 500, color: C.ink900 }}>{val}</span>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
