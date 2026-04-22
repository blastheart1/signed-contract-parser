'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight } from 'lucide-react';
import { Avatar, Pill, Banner } from '@/components/atlas';
import { ACCESS_MATRIX_SYSTEMS } from '@/lib/atlas/data';
import type { RoleTemplate } from '@/lib/atlas/data';
import { SYSTEM_KEY_MAP } from '@/lib/atlas/data';

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
};

const STEPS = ['Profile', 'Role & Start', 'Access Preset', 'Review'];

interface FormData {
  firstName: string;
  lastName: string;
  personalEmail: string;
  phone: string;
  location: string;
  employmentType: string;
  position: string;
  department: string;
  manager: string;
  startDate: string;
  compensation: string;
  compensationVisible: boolean;
  preset: string;
  companyEmailOverride: string;
  manualEmailOverride: boolean;
  entitlements: Record<string, boolean>;
}

const INITIAL: FormData = {
  firstName: '',
  lastName: '',
  personalEmail: '',
  phone: '',
  location: '',
  employmentType: 'Full-time',
  position: '',
  department: 'Operations',
  manager: '',
  startDate: '',
  compensation: '',
  compensationVisible: false,
  preset: '',
  companyEmailOverride: '',
  manualEmailOverride: false,
  entitlements: Object.fromEntries(ACCESS_MATRIX_SYSTEMS.map((s) => [s, false])),
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: 'block',
        fontSize: 11,
        fontWeight: 600,
        color: C.ink500,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}
    >
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled,
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      style={{
        width: '100%',
        padding: '7px 10px',
        borderRadius: 6,
        border: `1px solid ${C.ink100}`,
        background: disabled ? C.ink050 : C.paper0,
        fontSize: 13,
        color: C.ink900,
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '7px 10px',
        borderRadius: 6,
        border: `1px solid ${C.ink100}`,
        background: C.paper0,
        fontSize: 13,
        color: C.ink900,
        outline: 'none',
        cursor: 'pointer',
      }}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function Panel({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div
      style={{
        background: C.paper0,
        border: `1px solid ${C.ink100}`,
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 16,
      }}
    >
      {title && (
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.ink100}` }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.ink900 }}>{title}</p>
        </div>
      )}
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export default function IntakePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [roleTemplates, setRoleTemplates] = useState<RoleTemplate[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/atlas/role-templates')
      .then((r) => r.json())
      .then((data: RoleTemplate[]) => setRoleTemplates(data))
      .catch(() => {});
  }, []);

  // Auto-generate company email from name when not in manual override
  useEffect(() => {
    if (!form.manualEmailOverride && (form.firstName || form.lastName)) {
      const local = `${form.firstName.toLowerCase()}.${form.lastName.toLowerCase()}`.replace(/\s+/g, '');
      setForm((prev) => ({ ...prev, companyEmailOverride: local }));
    }
  }, [form.firstName, form.lastName, form.manualEmailOverride]);

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Resolved entitlements from selected preset
  const resolvedEntitlements: Record<string, boolean> = (() => {
    const tmpl = roleTemplates.find((t) => t.presetCode === form.preset || t.label === form.preset);
    if (!tmpl) return Object.fromEntries(ACCESS_MATRIX_SYSTEMS.map((s) => [s, false]));
    return Object.fromEntries(
      ACCESS_MATRIX_SYSTEMS.map((s) => [s, tmpl.entitlements[s] ?? false]),
    );
  })();

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const body = {
        firstName: form.firstName,
        lastName: form.lastName,
        personalEmail: form.personalEmail,
        phone: form.phone,
        location: form.location,
        employmentType: form.employmentType,
        position: form.position,
        department: form.department,
        managerName: form.manager,
        startDate: form.startDate,
        companyEmailLocal: form.companyEmailOverride,
        presetCode: form.preset,
        entitlements: resolvedEntitlements,
      };
      const res = await fetch('/api/atlas/workflow-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Submit failed');
      router.push('/atlas');
    } catch {
      alert('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const fullName = `${form.firstName} ${form.lastName}`.trim() || 'New Hire';
  const companyEmail = `${form.companyEmailOverride}@calimingo.com`;
  const presetOptions = roleTemplates.map((t) => t.label);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color: C.ink900 }}>
          New Hire Intake
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: C.ink500 }}>
          Queue a new onboarding workflow
        </p>
      </div>

      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <React.Fragment key={s}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
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
                    <Check size={13} color="#fff" strokeWidth={2.5} />
                  ) : (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: active ? '#fff' : C.ink500,
                      }}
                    >
                      {i + 1}
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    color: active ? C.ink900 : C.ink500,
                  }}
                >
                  {s}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: i < step ? C.ok : C.ink100,
                    margin: '0 12px',
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Two-col layout */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Main form */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Step 1: Profile */}
          {step === 0 && (
            <Panel title="Employee Profile">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '14px 16px',
                }}
              >
                <Field label="First name">
                  <Input value={form.firstName} onChange={(v) => set('firstName', v)} />
                </Field>
                <Field label="Last name">
                  <Input value={form.lastName} onChange={(v) => set('lastName', v)} />
                </Field>
                <Field label="Personal email">
                  <Input
                    type="email"
                    value={form.personalEmail}
                    onChange={(v) => set('personalEmail', v)}
                  />
                </Field>
                <Field label="Phone">
                  <Input value={form.phone} onChange={(v) => set('phone', v)} />
                </Field>
                <Field label="Location">
                  <Input value={form.location} onChange={(v) => set('location', v)} />
                </Field>
                <Field label="Employment type">
                  <Select
                    value={form.employmentType}
                    onChange={(v) => set('employmentType', v)}
                    options={['Full-time', 'Part-time', 'Contractor', 'Intern']}
                  />
                </Field>
              </div>
            </Panel>
          )}

          {/* Step 2: Role & Start */}
          {step === 1 && (
            <Panel title="Role & Start Date">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
                <Field label="Position">
                  <Input value={form.position} onChange={(v) => set('position', v)} />
                </Field>
                <Field label="Department">
                  <Select
                    value={form.department}
                    onChange={(v) => set('department', v)}
                    options={[
                      'Operations',
                      'Accounting',
                      'Construction',
                      'Marketing',
                      'People Ops',
                      'Sales',
                      'Service',
                    ]}
                  />
                </Field>
                <Field label="Hiring manager">
                  <Input
                    value={form.manager}
                    onChange={(v) => set('manager', v)}
                    placeholder="e.g. Derek Hollis"
                  />
                </Field>
                <Field label="Start date">
                  <Input type="date" value={form.startDate} onChange={(v) => set('startDate', v)} />
                </Field>
                <div style={{ gridColumn: 'span 2' }}>
                  <Field label="Compensation (restricted)">
                    <Input
                      type="password"
                      value={form.compensation}
                      onChange={(v) => set('compensation', v)}
                      placeholder="$00,000 / yr"
                    />
                  </Field>
                </div>
                <div
                  style={{
                    gridColumn: 'span 2',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <input
                    type="checkbox"
                    id="compVis"
                    checked={form.compensationVisible}
                    onChange={(e) => set('compensationVisible', e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="compVis" style={{ fontSize: 13, color: C.ink500, cursor: 'pointer' }}>
                    Make compensation visible to hiring manager
                  </label>
                </div>
              </div>
            </Panel>
          )}

          {/* Step 3: Access Preset */}
          {step === 2 && (
            <>
              <Panel title="Access Preset">
                <Field label="Role preset">
                  {presetOptions.length > 0 ? (
                    <Select
                      value={form.preset}
                      onChange={(v) => set('preset', v)}
                      options={presetOptions}
                    />
                  ) : (
                    <p style={{ margin: 0, fontSize: 13, color: C.ink500 }}>
                      No presets configured yet. Add presets in Settings → Access presets.
                    </p>
                  )}
                </Field>
                <div style={{ marginTop: 16 }}>
                  <Label>Resolved entitlements</Label>
                  <div
                    style={{
                      border: `1px solid ${C.ink100}`,
                      borderRadius: 6,
                      overflow: 'hidden',
                    }}
                  >
                    {ACCESS_MATRIX_SYSTEMS.map((sys, i) => {
                      const hasAccess = resolvedEntitlements[sys] ?? false;
                      return (
                        <div
                          key={sys}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderBottom:
                              i < ACCESS_MATRIX_SYSTEMS.length - 1
                                ? `1px solid ${C.ink100}`
                                : 'none',
                            background: i % 2 === 0 ? C.paper0 : C.paper1,
                          }}
                        >
                          <span style={{ fontSize: 13, color: C.ink900 }}>{sys}</span>
                          <div
                            style={{
                              width: 36,
                              height: 20,
                              borderRadius: 10,
                              background: hasAccess ? C.channel : C.ink300,
                              position: 'relative',
                              transition: 'background 0.2s',
                            }}
                          >
                            <div
                              style={{
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                background: '#fff',
                                position: 'absolute',
                                top: 2,
                                left: hasAccess ? 18 : 2,
                                transition: 'left 0.2s',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Panel>
              <Panel title="Company email">
                <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  <input
                    value={form.companyEmailOverride}
                    onChange={(e) => set('companyEmailOverride', e.target.value)}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      borderRadius: '6px 0 0 6px',
                      border: `1px solid ${C.ink100}`,
                      fontSize: 13,
                      color: C.ink900,
                      outline: 'none',
                    }}
                  />
                  <span
                    style={{
                      padding: '7px 10px',
                      borderRadius: '0 6px 6px 0',
                      border: `1px solid ${C.ink100}`,
                      borderLeft: 'none',
                      background: C.ink050,
                      fontSize: 13,
                      color: C.ink500,
                    }}
                  >
                    @calimingo.com
                  </span>
                </div>
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    id="emailOverride"
                    checked={form.manualEmailOverride}
                    onChange={(e) => set('manualEmailOverride', e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="emailOverride" style={{ fontSize: 13, color: C.ink500, cursor: 'pointer' }}>
                    Manual override
                  </label>
                </div>
              </Panel>
            </>
          )}

          {/* Step 4: Review */}
          {step === 3 && (
            <>
              <div style={{ marginBottom: 16 }}>
                <Banner
                  variant="info"
                  title="15 steps will be queued. 10 run automatically. 5 pause for review."
                />
              </div>
              <Panel title="Review — Employee Profile">
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px 20px',
                  }}
                >
                  {[
                    ['First name', form.firstName],
                    ['Last name', form.lastName],
                    ['Personal email', form.personalEmail],
                    ['Phone', form.phone],
                    ['Location', form.location],
                    ['Employment type', form.employmentType],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <p style={{ margin: 0, fontSize: 11, color: C.ink500, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {label}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: C.ink900 }}>{val || '—'}</p>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel title="Review — Role & Start">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                  {[
                    ['Position', form.position],
                    ['Department', form.department],
                    ['Manager', form.manager],
                    ['Start date', form.startDate],
                    ['Company email', companyEmail],
                    ['Preset', form.preset],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <p style={{ margin: 0, fontSize: 11, color: C.ink500, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {label}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: C.ink900 }}>{val || '—'}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            </>
          )}

          {/* Navigation buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              style={{
                padding: '8px 18px',
                borderRadius: 6,
                border: `1px solid ${C.ink100}`,
                background: C.paper0,
                color: C.ink500,
                fontSize: 13,
                cursor: step === 0 ? 'default' : 'pointer',
                opacity: step === 0 ? 0.4 : 1,
              }}
            >
              Back
            </button>
            {step < 3 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 6,
                  border: 'none',
                  background: C.channel,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                Continue
                <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  padding: '8px 20px',
                  borderRadius: 6,
                  border: 'none',
                  background: C.ok,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: submitting ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                <Check size={14} />
                {submitting ? 'Submitting…' : 'Submit & queue workflow'}
              </button>
            )}
          </div>
        </div>

        {/* Live preview sidebar */}
        <aside
          style={{
            width: 280,
            flexShrink: 0,
            background: C.paper0,
            border: `1px solid ${C.ink100}`,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${C.ink100}`,
              background: C.paper1,
            }}
          >
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
              Preview
            </p>
          </div>
          <div style={{ padding: 16 }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                paddingBottom: 16,
                borderBottom: `1px solid ${C.ink100}`,
                marginBottom: 14,
              }}
            >
              <Avatar name={fullName} size="lg" />
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.ink900 }}>{fullName}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: C.ink500 }}>{form.position || '—'}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: C.ink500 }}>
                  {companyEmail}
                </p>
              </div>
            </div>
            {[
              ['Start date', form.startDate || '—'],
              ['Manager', form.manager || '—'],
              ['Location', form.location || '—'],
              ['Department', form.department || '—'],
              ['Preset', form.preset || '—'],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: C.ink500 }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.ink900, textAlign: 'right', maxWidth: 140 }}>
                  {val}
                </span>
              </div>
            ))}
            <div style={{ marginTop: 12, borderTop: `1px solid ${C.ink100}`, paddingTop: 12 }}>
              <p style={{ margin: '0 0 6px', fontSize: 11, color: C.ink500, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Entitlements
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {ACCESS_MATRIX_SYSTEMS.map((sys) => {
                  const has = resolvedEntitlements[sys] ?? false;
                  if (!has) return null;
                  return (
                    <Pill key={sys} variant="ok" dot={false} size="sm">
                      {sys}
                    </Pill>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
