'use client';

import React, { useState, useEffect } from 'react';
import { Check, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ACCESS_MATRIX_SYSTEMS } from '@/lib/atlas/data';
import type { RoleTemplate } from '@/lib/atlas/data';
import { Pill, Avatar } from '@/components/atlas';
import { ATLAS_C as C } from '@/lib/atlas/tokens';

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

const TABS = ['Access presets', 'Orientation template', 'Integrations', 'Email templates', 'Permissions'];

const INTEGRATIONS = [
  { name: 'Google Workspace', owner: 'IT Team', status: 'connected' as const, lastSync: '2 min ago' },
  { name: 'Dropbox Business', owner: 'IT Team', status: 'connected' as const, lastSync: '5 min ago' },
  { name: 'Trello', owner: 'Admin Team', status: 'connected' as const, lastSync: '12 min ago' },
  { name: 'Bill.com', owner: 'Admin Team', status: 'connected' as const, lastSync: '1 hr ago' },
  { name: 'QuickBooks Online', owner: 'Admin Team', status: 'connected' as const, lastSync: '2 hr ago' },
  { name: 'Trainual', owner: 'HR Team', status: 'connected' as const, lastSync: '30 min ago' },
  { name: 'Fleet App', owner: 'IT Team', status: 'error' as const, lastSync: 'Failed 3h ago' },
];

const ORIENTATION_INVITES = [
  { title: 'Day-1 Orientation', attendees: 'All new hires', time: '9:00 AM, Day 1' },
  { title: 'Benefits Walkthrough', attendees: 'HR + Employee', time: '11:00 AM, Day 1' },
  { title: 'IT Setup Session', attendees: 'IT + Employee', time: '2:00 PM, Day 1' },
  { title: 'Manager 1:1', attendees: 'Manager + Employee', time: '10:00 AM, Day 2' },
  { title: '30-day Check-in', attendees: 'HR + Employee', time: 'Day 30' },
];

const EMAIL_TEMPLATES = [
  { key: 'offer-letter', name: 'Offer Letter', subject: 'Welcome to Calimingo Pools!', via: 'Docusign' },
  { key: 'day1-invite', name: 'Day-1 Invite', subject: 'Day-1 Schedule & Details', via: 'Gmail' },
  { key: 'system-access', name: 'System Access', subject: 'Your Calimingo Accounts Are Ready', via: 'Gmail' },
  { key: 'manager-intro', name: 'Manager Intro', subject: 'Meet Your New Team Member', via: 'Gmail' },
  { key: 'offboarding-notice', name: 'Offboarding Notice', subject: 'Transition Steps for [Name]', via: 'Gmail' },
];

const PERMISSIONS = [
  { role: 'HR', members: [] as string[], scope: 'Full access' },
  { role: 'IT', members: [] as string[], scope: 'System provisioning + runs' },
  { role: 'Admin', members: [] as string[], scope: 'Settings + templates' },
  { role: 'Manager', members: [] as string[], scope: 'View + approve own reports' },
  { role: 'Finance', members: [] as string[], scope: 'View compensation (restricted)' },
];

interface UserRow { id: number; username: string; role: string; }
type PermRow = { role: string; members: string[]; scope: string; };

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [roleTemplates, setRoleTemplates] = useState<RoleTemplate[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(true);
  const [permissions, setPermissions] = useState<PermRow[]>(PERMISSIONS);

  const [showNewPreset, setShowNewPreset] = useState(false);
  const [newPresetForm, setNewPresetForm] = useState({
    label: '',
    department: '',
    entitlements: Object.fromEntries(ACCESS_MATRIX_SYSTEMS.map((s) => [s, false])) as Record<string, boolean>,
  });
  const [savingPreset, setSavingPreset] = useState(false);

  function openNewPreset() {
    setNewPresetForm({
      label: '',
      department: '',
      entitlements: Object.fromEntries(ACCESS_MATRIX_SYSTEMS.map((s) => [s, false])) as Record<string, boolean>,
    });
    setShowNewPreset(true);
  }

  async function handleSavePreset() {
    if (!newPresetForm.label.trim()) return;
    setSavingPreset(true);
    try {
      await fetch('/api/atlas/role-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newPresetForm.label.trim(),
          department: newPresetForm.department.trim() || undefined,
          entitlements: newPresetForm.entitlements,
        }),
      });
      const data: RoleTemplate[] = await fetch('/api/atlas/role-templates').then((r) => r.json());
      setRoleTemplates(data);
      setShowNewPreset(false);
    } catch {
      // silently ignore; user can retry
    } finally {
      setSavingPreset(false);
    }
  }

  useEffect(() => {
    fetch('/api/atlas/role-templates')
      .then((r) => r.json())
      .then((data: RoleTemplate[]) => setRoleTemplates(data))
      .catch(() => {})
      .finally(() => setLoadingPresets(false));

    fetch('/api/atlas/users')
      .then((r) => r.json())
      .then((users: UserRow[]) => {
        setPermissions(
          PERMISSIONS.map((p) => ({
            ...p,
            members: users
              .filter((u) => u.role.toLowerCase() === p.role.toLowerCase())
              .map((u) => u.username),
          })),
        );
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 20px', fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color: C.ink900 }}>
        Settings
      </h1>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.ink100}`, marginBottom: 20, gap: 0 }}>
        {TABS.map((tab, i) => (
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
              whiteSpace: 'nowrap',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ─── Access presets ────────────────────────────────────────── */}
      {activeTab === 0 && (
        <Panel>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.ink100}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.ink900 }}>Role access presets</p>
            <button
              onClick={openNewPreset}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: `1px solid ${C.ink100}`,
                background: C.paper0,
                color: C.ink800,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              New preset
            </button>
          </div>
          {loadingPresets ? (
            <p style={{ padding: 18, fontSize: 13, color: C.ink500 }}>Loading…</p>
          ) : roleTemplates.length === 0 ? (
            <p style={{ padding: 18, fontSize: 13, color: C.ink500 }}>
              No presets configured. Click &ldquo;New preset&rdquo; to add one.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: C.paper1 }}>
                    <th
                      style={{
                        padding: '10px 18px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 600,
                        color: C.ink500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        minWidth: 180,
                      }}
                    >
                      Role
                    </th>
                    {ACCESS_MATRIX_SYSTEMS.map((sys) => (
                      <th
                        key={sys}
                        style={{
                          padding: '10px 8px',
                          textAlign: 'center',
                          width: 72,
                        }}
                      >
                        <div
                          style={{
                            writingMode: 'vertical-rl',
                            transform: 'rotate(180deg)',
                            fontSize: 11,
                            fontWeight: 600,
                            color: C.ink500,
                            whiteSpace: 'nowrap',
                            height: 80,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          {sys}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roleTemplates.map((tmpl, ri) => (
                    <tr
                      key={tmpl.id}
                      style={{
                        borderTop: `1px solid ${C.ink100}`,
                        background: ri % 2 === 0 ? C.paper0 : C.paper1,
                      }}
                    >
                      <td style={{ padding: '10px 18px', fontSize: 13, color: C.ink900, fontWeight: 500 }}>
                        {tmpl.label}
                      </td>
                      {ACCESS_MATRIX_SYSTEMS.map((sys) => {
                        const has = tmpl.entitlements[sys] ?? false;
                        return (
                          <td key={sys} style={{ padding: '10px 8px', textAlign: 'center' }}>
                            {has ? (
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: 22,
                                  height: 22,
                                  borderRadius: 4,
                                  background: C.okBg,
                                }}
                              >
                                <Check size={12} color={C.ok} strokeWidth={2.5} />
                              </div>
                            ) : (
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  background: C.ink100,
                                }}
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {/* ─── Orientation template ──────────────────────────────────── */}
      {activeTab === 1 && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <Panel style={{ flex: 1 }}>
            <PanelHeader title="Orientation invites" />
            <div>
              {ORIENTATION_INVITES.map((inv, i) => (
                <div
                  key={inv.title}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 18px',
                    borderBottom: i < ORIENTATION_INVITES.length - 1 ? `1px solid ${C.ink100}` : 'none',
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.ink900 }}>{inv.title}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: C.ink500 }}>
                      {inv.attendees} · {inv.time}
                    </p>
                  </div>
                  <button
                    onClick={() => toast.info('Template editor coming soon')}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 5,
                      border: `1px solid ${C.ink100}`,
                      background: C.paper0,
                      color: C.ink800,
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </Panel>
          <Panel style={{ width: 280 }}>
            <PanelHeader title="Calendar placeholders" />
            <div style={{ padding: 14 }}>
              {['Day 1 — Full day blocked', 'Day 2 — Half day', 'Day 7 — Check-in', 'Day 30 — Review'].map(
                (p) => (
                  <div
                    key={p}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 5,
                      background: C.paper2,
                      marginBottom: 8,
                      fontSize: 12,
                      color: C.ink900,
                    }}
                  >
                    {p}
                  </div>
                ),
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* ─── Integrations ──────────────────────────────────────────── */}
      {activeTab === 2 && (
        <Panel>
          <PanelHeader title="Connected integrations" />
          <div>
            {INTEGRATIONS.map((intg, i) => (
              <div
                key={intg.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 18px',
                  borderBottom: i < INTEGRATIONS.length - 1 ? `1px solid ${C.ink100}` : 'none',
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.ink900 }}>{intg.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: C.ink500 }}>
                    {intg.owner} · Synced {intg.lastSync}
                  </p>
                </div>
                <Pill variant={intg.status === 'connected' ? 'ok' : 'crit'} size="sm">
                  {intg.status}
                </Pill>
                <button
                  onClick={() => toast.info(`Integration configuration coming soon`)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 5,
                    border: `1px solid ${C.ink100}`,
                    background: C.paper0,
                    color: C.ink800,
                    fontSize: 11,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <SettingsIcon size={11} />
                  Configure
                </button>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ─── Email templates ───────────────────────────────────────── */}
      {activeTab === 3 && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div
            style={{
              width: 240,
              flexShrink: 0,
              background: C.paper0,
              border: `1px solid ${C.ink100}`,
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            {EMAIL_TEMPLATES.map((t, i) => (
              <button
                key={t.key}
                onClick={() => setSelectedTemplate(i)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  textAlign: 'left',
                  border: 'none',
                  borderBottom: i < EMAIL_TEMPLATES.length - 1 ? `1px solid ${C.ink100}` : 'none',
                  background: selectedTemplate === i ? C.ink050 : C.paper0,
                  cursor: 'pointer',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: selectedTemplate === i ? 600 : 400,
                    color: selectedTemplate === i ? C.ink900 : C.ink800,
                  }}
                >
                  {t.name}
                </p>
                <p style={{ margin: '1px 0 0', fontSize: 11, color: C.ink500 }}>via {t.via}</p>
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }}>
            <Panel>
              <PanelHeader title={`Preview: ${EMAIL_TEMPLATES[selectedTemplate].name}`} />
              <div style={{ padding: 0 }}>
                <div
                  style={{
                    background: C.gold,
                    padding: '24px 32px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      background: C.paper2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'Oswald, sans-serif',
                      fontWeight: 700,
                      fontSize: 18,
                      color: C.channel,
                    }}
                  >
                    C
                  </div>
                  <span
                    style={{
                      fontFamily: 'Oswald, sans-serif',
                      fontWeight: 700,
                      fontSize: 18,
                      color: '#FFFFFF',
                      letterSpacing: '0.08em',
                    }}
                  >
                    CALIMINGO
                  </span>
                </div>
                <div style={{ padding: '28px 32px' }}>
                  <p style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: C.ink900 }}>
                    {EMAIL_TEMPLATES[selectedTemplate].subject}
                  </p>
                  <p style={{ margin: '0 0 10px', fontSize: 13, color: C.ink800, lineHeight: 1.7 }}>
                    Hi [First Name],
                  </p>
                  <p style={{ margin: '0 0 10px', fontSize: 13, color: C.ink800, lineHeight: 1.7 }}>
                    {EMAIL_TEMPLATES[selectedTemplate].key === 'offer-letter'
                      ? 'We are thrilled to extend this offer to join the Calimingo Pools family. Please review and sign your offer letter at your earliest convenience.'
                      : EMAIL_TEMPLATES[selectedTemplate].key === 'day1-invite'
                      ? "Your first day is just around the corner! Here's what to expect on Day 1 at Calimingo."
                      : EMAIL_TEMPLATES[selectedTemplate].key === 'system-access'
                      ? 'Your Calimingo accounts have been provisioned. You now have access to all the tools you need to hit the ground running.'
                      : EMAIL_TEMPLATES[selectedTemplate].key === 'manager-intro'
                      ? 'Please join us in welcoming a new team member to the Calimingo family.'
                      : 'As part of your transition, please follow the steps outlined below to ensure a smooth offboarding process.'}
                  </p>
                  <div style={{ margin: '20px 0' }}>
                    <a
                      href="#"
                      style={{
                        display: 'inline-block',
                        padding: '10px 22px',
                        borderRadius: 6,
                        background: C.channel,
                        color: '#FFFFFF',
                        textDecoration: 'none',
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {EMAIL_TEMPLATES[selectedTemplate].key === 'offer-letter' ? 'Review & Sign' : 'Get Started'}
                    </a>
                  </div>
                  <p style={{ margin: '20px 0 0', fontSize: 12, color: C.ink500, lineHeight: 1.6 }}>
                    This is an automated message from Atlas HR Operations. Please do not reply to this email.
                    <br />
                    Calimingo Pools · Irvine, CA
                  </p>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* ─── New preset modal ──────────────────────────────────────── */}
      {showNewPreset && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              padding: 24,
              width: 480,
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <p style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: C.ink900 }}>New access preset</p>

            {/* Label */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.ink500, marginBottom: 4 }}>
                Role label <span style={{ color: C.channel }}>*</span>
              </label>
              <input
                value={newPresetForm.label}
                onChange={(e) => setNewPresetForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Field Technician"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '7px 10px',
                  borderRadius: 6,
                  border: `1px solid ${C.ink100}`,
                  fontSize: 13,
                  color: C.ink900,
                  outline: 'none',
                }}
              />
            </div>

            {/* Department */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.ink500, marginBottom: 4 }}>
                Department <span style={{ fontSize: 11, fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                value={newPresetForm.department}
                onChange={(e) => setNewPresetForm((f) => ({ ...f, department: e.target.value }))}
                placeholder="e.g. Operations"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '7px 10px',
                  borderRadius: 6,
                  border: `1px solid ${C.ink100}`,
                  fontSize: 13,
                  color: C.ink900,
                  outline: 'none',
                }}
              />
            </div>

            {/* System toggles */}
            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: C.ink500 }}>System access</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {ACCESS_MATRIX_SYSTEMS.map((sys) => {
                const on = newPresetForm.entitlements[sys] ?? false;
                return (
                  <div
                    key={sys}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <span style={{ fontSize: 13, color: C.ink900 }}>{sys}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setNewPresetForm((f) => ({
                          ...f,
                          entitlements: { ...f.entitlements, [sys]: !f.entitlements[sys] },
                        }))
                      }
                      style={{
                        width: 36,
                        height: 20,
                        borderRadius: 10,
                        border: 'none',
                        cursor: 'pointer',
                        background: on ? C.channel : C.ink300,
                        position: 'relative',
                        flexShrink: 0,
                        transition: 'background 0.15s',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: 2,
                          left: on ? 18 : 2,
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: '#fff',
                          transition: 'left 0.15s',
                        }}
                      />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowNewPreset(false)}
                style={{
                  padding: '7px 16px',
                  borderRadius: 6,
                  border: `1px solid ${C.ink100}`,
                  background: C.paper0,
                  color: C.ink500,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSavePreset}
                disabled={savingPreset || !newPresetForm.label.trim()}
                style={{
                  padding: '7px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: C.channel,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: savingPreset || !newPresetForm.label.trim() ? 'not-allowed' : 'pointer',
                  opacity: savingPreset || !newPresetForm.label.trim() ? 0.6 : 1,
                }}
              >
                {savingPreset ? 'Saving…' : 'Save preset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Permissions ───────────────────────────────────────────── */}
      {activeTab === 4 && (
        <Panel>
          <PanelHeader title="Role permissions" />
          <div>
            {permissions.map((perm, i) => (
              <div
                key={perm.role}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '14px 18px',
                  borderBottom: i < permissions.length - 1 ? `1px solid ${C.ink100}` : 'none',
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.ink900 }}>{perm.role}</p>
                  <p style={{ margin: '2px 0 4px', fontSize: 12, color: C.ink500 }}>{perm.scope}</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {perm.members.map((m) => (
                      <div
                        key={m}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          background: C.ink050,
                          borderRadius: 20,
                          padding: '2px 8px 2px 4px',
                        }}
                      >
                        <Avatar name={m} size="sm" />
                        <span style={{ fontSize: 11, color: C.ink800 }}>{m}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => toast.info('Template editor coming soon')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 5,
                    border: `1px solid ${C.ink100}`,
                    background: C.paper0,
                    color: C.ink800,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
