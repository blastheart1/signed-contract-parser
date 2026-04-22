'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, XCircle, Play } from 'lucide-react';
import { EMPLOYEES, WORKFLOW_LOG } from '@/lib/atlas/data';
import { Avatar, StatusPill, Pill, Banner } from '@/components/atlas';

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
  info:  C.info,
  ok:    C.ok,
  warn:  C.warn,
  error: C.crit,
};

const PAYLOAD = {
  workflowId: 'RUN-2026-0481',
  employeeId: 'E-2481',
  name: 'Marcelle Ortega',
  startDate: '2026-04-28',
  preset: 'Pool Service Technician',
  manager: 'Derek Hollis',
  location: 'Irvine, CA',
  email: 'marcelle.ortega@calimingo.com',
  steps: 15,
  autoSteps: 10,
  reviewSteps: 5,
};

const INTERVENTIONS = [
  { actor: 'System', msg: 'Trainual invite bounce — auto-retry triggered', time: '08:04:01' },
  { actor: 'Vic Kaur', msg: 'Confirmed device shipped to Irvine address', time: '08:10:22' },
  { actor: 'System', msg: 'Awaiting Bill.com manager approval from Derek Hollis', time: '08:05:03' },
];

type LogFilter = 'all' | 'warn' | 'error';

export default function WorkflowRunPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const emp = EMPLOYEES.find((e) => e.id === id) ?? EMPLOYEES[0];
  const [logFilter, setLogFilter] = useState<LogFilter>('all');

  const filteredLog = WORKFLOW_LOG.filter((l) => {
    if (logFilter === 'warn') return l.lvl === 'warn';
    if (logFilter === 'error') return l.lvl === 'error';
    return true;
  });

  const warnCount = WORKFLOW_LOG.filter((l) => l.lvl === 'warn').length;
  const errorCount = WORKFLOW_LOG.filter((l) => l.lvl === 'error').length;

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
              RUN-2026-0481
            </span>
            <Pill variant="warn">Paused · manual review</Pill>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: C.ink500 }}>
            {emp.name} · Started 2026-04-22 08:00 UTC · {WORKFLOW_LOG.length} events
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '7px 12px',
              borderRadius: 6,
              border: `1px solid ${C.ink100}`,
              background: C.paper0,
              fontSize: 12,
              cursor: 'pointer',
              color: C.ink800,
            }}
          >
            <RefreshCw size={12} />
            Retry failed
          </button>
          <button
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
              cursor: 'pointer',
            }}
          >
            <XCircle size={12} />
            Cancel run
          </button>
          <button
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
              cursor: 'pointer',
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
          { label: 'Duration', value: '00:17:23', sub: 'elapsed', subColor: C.ink500 },
          { label: 'Steps', value: '7 / 15', sub: 'completed', subColor: C.ink500 },
          { label: 'Retries', value: '1', sub: 'auto-retried', subColor: C.warn, valueColor: C.warn },
          { label: 'Awaiting human', value: '1', sub: 'Bill.com approval', subColor: C.info },
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
              {([['all', WORKFLOW_LOG.length], ['warn', warnCount], ['error', errorCount]] as const).map(
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
              {filteredLog.map((entry, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '6px 18px',
                    background:
                      entry.lvl === 'warn'
                        ? C.warnBg
                        : entry.lvl === 'error'
                        ? '#FDECEA'
                        : 'transparent',
                    borderBottom: `1px solid ${C.ink100}`,
                    alignItems: 'flex-start',
                  }}
                >
                  <span style={{ fontSize: 11, color: C.ink500, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {entry.ts.split('T')[1].replace('Z', '')}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: LVL_COLOR[entry.lvl] ?? C.ink500,
                      textTransform: 'uppercase',
                      width: 36,
                      flexShrink: 0,
                    }}
                  >
                    {entry.lvl}
                  </span>
                  <span style={{ fontSize: 12, color: C.ink900, flex: 1 }}>{entry.msg}</span>
                </div>
              ))}
            </div>
          </Panel>

          {/* Awaiting human */}
          <Panel>
            <PanelHeader title="Awaiting human — Step 7: Bill.com invite" />
            <div style={{ padding: 18 }}>
              <div
                style={{
                  background: C.ink050,
                  borderRadius: 6,
                  padding: '12px 14px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 12,
                  color: C.ink900,
                  marginBottom: 14,
                  lineHeight: 1.6,
                }}
              >
                <p style={{ margin: '0 0 4px', fontWeight: 700 }}>TO: derek.hollis@calimingo.com</p>
                <p style={{ margin: '0 0 4px' }}>FROM: atlas-noreply@calimingo.com</p>
                <p style={{ margin: '0 0 12px' }}>SUBJECT: Approve Bill.com access for Marcelle Ortega</p>
                <p style={{ margin: '0 0 4px' }}>Hi Derek,</p>
                <p style={{ margin: '0 0 4px' }}>
                  Please approve Bill.com access for Marcelle Ortega (E-2481) who starts on April 28.
                </p>
                <p style={{ margin: 0 }}>Click Approve or Deny to proceed.</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
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
                  Approve &amp; Send
                </button>
                <button
                  style={{
                    padding: '7px 14px',
                    borderRadius: 6,
                    border: `1px solid ${C.ink100}`,
                    background: C.paper0,
                    color: C.ink500,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Skip
                </button>
                <button
                  style={{
                    padding: '7px 14px',
                    borderRadius: 6,
                    border: `1px solid ${C.ink100}`,
                    background: C.paper0,
                    color: C.ink500,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Edit template
                </button>
              </div>
            </div>
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
              {JSON.stringify(PAYLOAD, null, 2)}
            </pre>
          </Panel>

          {/* Interventions */}
          <Panel>
            <PanelHeader title="Interventions" />
            <div>
              {INTERVENTIONS.map((intvn, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 18px',
                    borderBottom: i < INTERVENTIONS.length - 1 ? `1px solid ${C.ink100}` : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.ink900 }}>{intvn.actor}</span>
                    <span
                      style={{
                        fontSize: 11,
                        color: C.ink500,
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      {intvn.time}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: C.ink500 }}>{intvn.msg}</p>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
