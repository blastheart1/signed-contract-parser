'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { EmployeeProfile, EquipmentRow, CardRow, NoteRow, AccessAccountRow } from '@/lib/atlas/queries';
import { Avatar, Pill, Banner, StatusPill } from '@/components/atlas';
import { ATLAS_C as C } from '@/lib/atlas/tokens';
import { toast } from 'sonner';

// ─── Shared UI atoms ────────────────────────────────────────────────────────

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.paper0, border: `1px solid ${C.ink100}`, borderRadius: 8, overflow: 'hidden', ...style }}>
      {children}
    </div>
  );
}

function PanelHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.ink100}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.ink900 }}>{title}</p>
      {action}
    </div>
  );
}

function Btn({
  children, variant = 'outline', onClick, disabled, type = 'button',
}: {
  children: React.ReactNode;
  variant?: 'outline' | 'primary' | 'ghost' | 'crit' | 'warn';
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: C.channel, color: '#fff', border: 'none' },
    outline: { background: C.paper0, color: C.ink800, border: `1px solid ${C.ink100}` },
    ghost:   { background: 'transparent', color: C.ink500, border: 'none' },
    crit:    { background: C.paper0, color: C.crit, border: `1px solid ${C.crit}` },
    warn:    { background: C.paper0, color: C.warn, border: `1px solid ${C.warn}` },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        display: 'inline-flex', alignItems: 'center', gap: 5, ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

function FieldGrid({ entries }: { entries: [string, string | null | undefined][] }) {
  return (
    <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
      {entries.map(([label, val]) => (
        <div key={label}>
          <p style={{ margin: 0, fontSize: 11, color: C.ink500, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: C.ink900 }}>{val || '—'}</p>
        </div>
      ))}
    </div>
  );
}

function fmtDate(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Equipment helpers ───────────────────────────────────────────────────────

const EQ_ICON: Record<string, string> = {
  laptop: '💻', mobile: '📱', monitor: '🖥️', headset: '🎧',
  keyboard: '⌨️', mouse: '🖱️', tablet: '📱', other: '📦',
};

function conditionVariant(c: string) {
  if (c === 'new') return 'ok' as const;
  if (c === 'good') return 'info' as const;
  if (c === 'fair') return 'warn' as const;
  return 'crit' as const;
}

// ─── Tab: Profile ────────────────────────────────────────────────────────────

interface EditForm {
  firstName: string;
  lastName: string;
  personalEmail: string;
  phone: string;
  location: string;
  employmentType: string;
  position: string;
  department: string;
  managerName: string;
}

function ProfileTab({
  employee,
  onArchive,
  onUpdate,
}: {
  employee: EmployeeProfile;
  onArchive: () => void;
  onUpdate: (updated: Partial<EmployeeProfile>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    firstName: employee.firstName,
    lastName: employee.lastName,
    personalEmail: employee.personalEmail ?? '',
    phone: employee.phone ?? '',
    location: employee.location ?? '',
    employmentType: employee.employmentType ?? '',
    position: employee.position ?? '',
    department: employee.department ?? '',
    managerName: employee.managerName ?? '',
  });
  const [compensation, setCompensation] = useState<{ salary: string | null; visibility: string } | null>(null);
  const router = useRouter();
  const isArchived = !!employee.deletedAt;

  useEffect(() => {
    fetch(`/api/atlas/employees/${employee.id}/compensation`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setCompensation(d))
      .catch(() => {});
  }, [employee.id]);

  function startEdit() {
    setEditForm({
      firstName: employee.firstName,
      lastName: employee.lastName,
      personalEmail: employee.personalEmail ?? '',
      phone: employee.phone ?? '',
      location: employee.location ?? '',
      employmentType: employee.employmentType ?? '',
      position: employee.position ?? '',
      department: employee.department ?? '',
      managerName: employee.managerName ?? '',
    });
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/atlas/employees/${employee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', ...editForm }),
      });
      if (!res.ok) throw new Error('Save failed');
      onUpdate(editForm);
      setEditing(false);
    } catch {
      alert('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveToggle() {
    if (!confirm(isArchived ? 'Restore this employee?' : 'Archive this employee?')) return;
    setBusy(true);
    await fetch(`/api/atlas/employees/${employee.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: isArchived ? 'restore' : 'archive' }),
    });
    setBusy(false);
    if (!isArchived) {
      router.push('/atlas/employees');
    } else {
      onArchive();
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: '4px 7px', borderRadius: 5, border: `1px solid ${C.ink100}`,
    fontSize: 13, color: C.ink900, background: C.paper0, width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <Panel style={{ flex: 1, minWidth: 280 }}>
        <PanelHeader
          title="Personal Info"
          action={
            editing ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn variant="primary" onClick={handleSave} disabled={saving}>{saving ? '…' : 'Save'}</Btn>
                <Btn variant="outline" onClick={() => setEditing(false)}>Cancel</Btn>
              </div>
            ) : (
              <Btn variant="outline" onClick={startEdit}>Edit</Btn>
            )
          }
        />
        {editing ? (
          <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
            {(
              [
                ['First name', 'firstName'],
                ['Last name', 'lastName'],
                ['Personal email', 'personalEmail'],
                ['Phone', 'phone'],
                ['Location', 'location'],
                ['Employment type', 'employmentType'],
              ] as [string, keyof EditForm][]
            ).map(([label, key]) => (
              <div key={key}>
                <p style={{ margin: 0, fontSize: 11, color: C.ink500, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                <input
                  style={inputStyle}
                  value={editForm[key]}
                  onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        ) : (
          <FieldGrid entries={[
            ['First name', employee.firstName],
            ['Last name', employee.lastName],
            ['Personal email', employee.personalEmail],
            ['Phone', employee.phone],
            ['Location', employee.location],
            ['Employment type', employee.employmentType],
          ]} />
        )}
      </Panel>

      <Panel style={{ flex: 1, minWidth: 280 }}>
        <PanelHeader
          title="Role Info"
          action={
            <Btn variant={isArchived ? 'outline' : 'crit'} onClick={handleArchiveToggle} disabled={busy}>
              {busy ? '…' : isArchived ? 'Restore' : 'Archive'}
            </Btn>
          }
        />
        {editing ? (
          <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
            {(
              [
                ['Position', 'position'],
                ['Department', 'department'],
                ['Manager', 'managerName'],
              ] as [string, keyof EditForm][]
            ).map(([label, key]) => (
              <div key={key}>
                <p style={{ margin: 0, fontSize: 11, color: C.ink500, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                <input
                  style={inputStyle}
                  value={editForm[key]}
                  onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                />
              </div>
            ))}
            <div>
              <p style={{ margin: 0, fontSize: 11, color: C.ink500, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Start date</p>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: C.ink900 }}>{fmtDate(employee.startDate) || '—'}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: C.ink500, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Company email</p>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: C.ink900 }}>{employee.companyEmail || '—'}</p>
            </div>
          </div>
        ) : (
          <FieldGrid entries={[
            ['Position', employee.position],
            ['Department', employee.department],
            ['Manager', employee.managerName],
            ['Start date', fmtDate(employee.startDate)],
            ['End date', fmtDate(employee.endDate)],
            ['Access preset', employee.accessPreset],
            ['Company email', employee.companyEmail],
            ...(compensation?.salary ? [['Compensation', `${compensation.salary} (${compensation.visibility})`] as [string, string]] : []),
          ]} />
        )}
      </Panel>
    </div>
  );
}

// ─── Tab: Equipment ──────────────────────────────────────────────────────────

function EquipmentTab({ employeeId }: { employeeId: string }) {
  const [rows, setRows] = useState<EquipmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'laptop', brand: '', model: '', serialNumber: '', assetTag: '', condition: 'good', notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/atlas/employees/${employeeId}/equipment`);
    const data = await res.json();
    setRows(data);
    setLoading(false);
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/atlas/employees/${employeeId}/equipment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({ type: 'laptop', brand: '', model: '', serialNumber: '', assetTag: '', condition: 'good', notes: '' });
    load();
  }

  async function handleReturn(eqId: string) {
    await fetch(`/api/atlas/employees/${employeeId}/equipment/${eqId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'return' }),
    });
    load();
  }

  async function handleRemove(eqId: string) {
    if (!confirm('Remove this equipment record?')) return;
    await fetch(`/api/atlas/employees/${employeeId}/equipment/${eqId}`, { method: 'DELETE' });
    load();
  }

  const inputStyle: React.CSSProperties = {
    padding: '6px 8px', borderRadius: 5, border: `1px solid ${C.ink100}`,
    fontSize: 12, color: C.ink900, background: C.paper0, width: '100%', boxSizing: 'border-box',
  };

  return (
    <Panel>
      <PanelHeader
        title="Equipment"
        action={<Btn variant="primary" onClick={() => setShowForm(!showForm)}>+ Add equipment</Btn>}
      />

      {showForm && (
        <form onSubmit={handleAdd} style={{ padding: 16, borderBottom: `1px solid ${C.ink100}`, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: C.ink500, fontWeight: 600 }}>Type</label>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inputStyle}>
              {['laptop','mobile','monitor','tablet','headset','keyboard','mouse','other'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.ink500, fontWeight: 600 }}>Brand</label>
            <input style={inputStyle} value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} placeholder="e.g. Apple" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.ink500, fontWeight: 600 }}>Model</label>
            <input style={inputStyle} value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="e.g. MacBook Pro 14" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.ink500, fontWeight: 600 }}>Serial #</label>
            <input style={inputStyle} value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.ink500, fontWeight: 600 }}>Asset Tag</label>
            <input style={inputStyle} value={form.assetTag} onChange={e => setForm({ ...form, assetTag: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.ink500, fontWeight: 600 }}>Condition</label>
            <select value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })} style={inputStyle}>
              {['new','good','fair','damaged'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11, color: C.ink500, fontWeight: 600 }}>Notes</label>
            <input style={inputStyle} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
            <Btn variant="primary" type="submit">Save</Btn>
            <Btn variant="outline" onClick={() => setShowForm(false)}>Cancel</Btn>
          </div>
        </form>
      )}

      {loading ? (
        <p style={{ padding: '16px 18px', fontSize: 13, color: C.ink500 }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ padding: '16px 18px', fontSize: 13, color: C.ink500 }}>No equipment assigned.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.ink100}` }}>
                {['', 'Type', 'Brand', 'Model', 'Serial #', 'Asset Tag', 'Condition', 'Assigned', 'Returned', ''].map((h, i) => (
                  <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.ink500, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} style={{ borderBottom: `1px solid ${C.ink100}` }}>
                  <td style={{ padding: '10px 12px' }}>
                    <input type="checkbox" readOnly checked={!!row.returnedAt} style={{ cursor: 'default' }} />
                  </td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    <span style={{ marginRight: 6 }}>{EQ_ICON[row.type] ?? '📦'}</span>{row.type}
                  </td>
                  <td style={{ padding: '10px 12px' }}>{row.brand ?? '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{row.model ?? '—'}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{row.serialNumber ?? '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{row.assetTag ?? '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <Pill variant={conditionVariant(row.condition)} dot={false}>{row.condition}</Pill>
                  </td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: C.ink500 }}>{fmtDate(row.assignedAt)}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: C.ink500 }}>{row.returnedAt ? fmtDate(row.returnedAt) : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {!row.returnedAt && (
                        <Btn variant="outline" onClick={() => handleReturn(row.id)}>Return</Btn>
                      )}
                      <Btn variant="crit" onClick={() => handleRemove(row.id)}>Remove</Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ─── Tab: Cards ──────────────────────────────────────────────────────────────

function fmtMoney(cents: number | null, currency: string) {
  if (cents === null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100);
}

function cardStatusVariant(status: string) {
  if (status === 'active') return 'ok' as const;
  if (status === 'suspended') return 'warn' as const;
  return 'neutral' as const;
}

function CardsTab({ employeeId }: { employeeId: string }) {
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    cardholderName: '', last4: '', issuer: 'Visa', creditLimit: '',
    currency: 'USD', isSupplementary: false, primaryOwnerName: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/atlas/employees/${employeeId}/cards`);
    const data = await res.json();
    setCards(data);
    setLoading(false);
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/atlas/employees/${employeeId}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cardholderName: form.cardholderName,
        last4: form.last4 || null,
        issuer: form.issuer,
        creditLimit: form.creditLimit ? Math.round(parseFloat(form.creditLimit) * 100) : null,
        currency: form.currency,
        supplementaryTo: form.isSupplementary ? form.primaryOwnerName : null,
        primaryOwnerName: form.isSupplementary ? form.primaryOwnerName : null,
      }),
    });
    setShowForm(false);
    setForm({ cardholderName: '', last4: '', issuer: 'Visa', creditLimit: '', currency: 'USD', isSupplementary: false, primaryOwnerName: '' });
    load();
  }

  async function handleStatusChange(cardId: string, action: string) {
    await fetch(`/api/atlas/employees/${employeeId}/cards/${cardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    load();
  }

  function statusAction(status: string): { label: string; action: string; variant: 'warn' | 'outline' | 'crit' } | null {
    if (status === 'active') return { label: 'Suspend', action: 'suspend', variant: 'warn' };
    if (status === 'suspended') return { label: 'Reactivate', action: 'reactivate', variant: 'outline' };
    if (status !== 'cancelled') return { label: 'Cancel', action: 'cancel', variant: 'crit' };
    return null;
  }

  const inputStyle: React.CSSProperties = {
    padding: '6px 8px', borderRadius: 5, border: `1px solid ${C.ink100}`,
    fontSize: 12, color: C.ink900, background: C.paper0, width: '100%', boxSizing: 'border-box',
  };

  return (
    <Panel>
      <PanelHeader
        title="Cards"
        action={<Btn variant="primary" onClick={() => setShowForm(!showForm)}>+ Add card</Btn>}
      />

      {showForm && (
        <form onSubmit={handleAdd} style={{ padding: 16, borderBottom: `1px solid ${C.ink100}`, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11, color: C.ink500, fontWeight: 600 }}>Cardholder Name *</label>
            <input required style={inputStyle} value={form.cardholderName} onChange={e => setForm({ ...form, cardholderName: e.target.value })} placeholder="Full name on card" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.ink500, fontWeight: 600 }}>Last 4 digits</label>
            <input maxLength={4} style={inputStyle} value={form.last4} onChange={e => setForm({ ...form, last4: e.target.value.replace(/\D/g, '') })} placeholder="1234" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.ink500, fontWeight: 600 }}>Issuer</label>
            <select style={inputStyle} value={form.issuer} onChange={e => setForm({ ...form, issuer: e.target.value })}>
              {['Visa','Mastercard','Amex','other'].map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.ink500, fontWeight: 600 }}>Currency</label>
            <input style={inputStyle} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase() })} placeholder="USD" maxLength={3} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.ink500, fontWeight: 600 }}>Credit Limit ($)</label>
            <input type="number" min="0" style={inputStyle} value={form.creditLimit} onChange={e => setForm({ ...form, creditLimit: e.target.value })} placeholder="5000" />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="supp" checked={form.isSupplementary} onChange={e => setForm({ ...form, isSupplementary: e.target.checked })} />
            <label htmlFor="supp" style={{ fontSize: 12, color: C.ink800 }}>Supplementary card</label>
          </div>
          {form.isSupplementary && (
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 11, color: C.ink500, fontWeight: 600 }}>Primary Owner Name</label>
              <input style={inputStyle} value={form.primaryOwnerName} onChange={e => setForm({ ...form, primaryOwnerName: e.target.value })} placeholder="Name of primary cardholder" />
            </div>
          )}
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
            <Btn variant="primary" type="submit">Save</Btn>
            <Btn variant="outline" onClick={() => setShowForm(false)}>Cancel</Btn>
          </div>
        </form>
      )}

      {loading ? (
        <p style={{ padding: '16px 18px', fontSize: 13, color: C.ink500 }}>Loading…</p>
      ) : cards.length === 0 ? (
        <p style={{ padding: '16px 18px', fontSize: 13, color: C.ink500 }}>No cards assigned.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.ink100}` }}>
                {['Cardholder', 'Issuer', 'Last 4', 'Limit', 'Currency', 'Supplementary to', 'Status', ''].map((h, i) => (
                  <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.ink500, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cards.map(card => {
                const btn = statusAction(card.status);
                return (
                  <tr key={card.id} style={{ borderBottom: `1px solid ${C.ink100}` }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{card.cardholderName}</td>
                    <td style={{ padding: '10px 12px' }}>{card.issuer}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{card.last4 ? `••••${card.last4}` : '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{fmtMoney(card.creditLimit, card.currency)}</td>
                    <td style={{ padding: '10px 12px' }}>{card.currency}</td>
                    <td style={{ padding: '10px 12px', color: C.ink500 }}>{card.primaryOwnerName ?? '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <Pill variant={cardStatusVariant(card.status)} dot={false}>{card.status}</Pill>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {btn && (
                        <Btn variant={btn.variant} onClick={() => handleStatusChange(card.id, btn.action)}>{btn.label}</Btn>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ─── Tab: Workflow ────────────────────────────────────────────────────────────

function WorkflowTab({ runs }: { runs: EmployeeProfile['runs'] }) {
  function runStatusVariant(status: string) {
    if (status === 'completed') return 'ok' as const;
    if (status === 'in-progress') return 'info' as const;
    if (status === 'blocked' || status === 'failed') return 'crit' as const;
    return 'neutral' as const;
  }

  return (
    <Panel>
      <PanelHeader title="Workflow Runs" />
      {runs.length === 0 ? (
        <p style={{ padding: '16px 18px', fontSize: 13, color: C.ink500 }}>No workflow runs yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.ink100}` }}>
              {['Run code', 'Type', 'Status', 'Started'].map(h => (
                <th key={h} style={{ padding: '8px 18px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.ink500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.map(run => (
              <tr
                key={run.runId}
                style={{ borderBottom: `1px solid ${C.ink100}`, cursor: 'pointer' }}
                onClick={() => window.location.href = `/atlas/workflows/${run.runId}`}
              >
                <td style={{ padding: '10px 18px' }}>
                  <a href={`/atlas/workflows/${run.runId}`} style={{ color: C.info, textDecoration: 'none', fontWeight: 500 }} onClick={e => e.stopPropagation()}>
                    {run.runCode}
                    <ExternalLink size={11} style={{ marginLeft: 4, verticalAlign: 'middle' }} />
                  </a>
                </td>
                <td style={{ padding: '10px 18px' }}>
                  <Pill variant={run.type === 'onboarding' ? 'ok' : 'gold'} dot={false}>{run.type}</Pill>
                </td>
                <td style={{ padding: '10px 18px' }}>
                  <Pill variant={runStatusVariant(run.status)} dot>{run.status}</Pill>
                </td>
                <td style={{ padding: '10px 18px', color: C.ink500 }}>{run.startedAt ? fmtDate(run.startedAt) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

// ─── Tab: Notes ───────────────────────────────────────────────────────────────

function NotesTab({ employeeId }: { employeeId: string }) {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/atlas/notes?employeeId=${employeeId}`);
    const data = await res.json();
    setNotes(data);
    setLoading(false);
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!body.trim()) return;
    setSaving(true);
    await fetch('/api/atlas/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, body, authorLabel: 'HR Admin' }),
    });
    setBody('');
    setSaving(false);
    load();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Panel>
        <PanelHeader title="Add note" />
        <div style={{ padding: 18 }}>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Add a note about this employee…"
            style={{
              width: '100%', minHeight: 80, padding: '8px 10px', borderRadius: 6,
              border: `1px solid ${C.ink100}`, fontSize: 13, color: C.ink900,
              outline: 'none', resize: 'vertical', fontFamily: 'Poppins, sans-serif', boxSizing: 'border-box',
            }}
          />
          <Btn variant="primary" onClick={handleSave} disabled={saving || !body.trim()}>
            {saving ? 'Saving…' : 'Save note'}
          </Btn>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Notes" />
        {loading ? (
          <p style={{ padding: '16px 18px', fontSize: 13, color: C.ink500 }}>Loading…</p>
        ) : notes.length === 0 ? (
          <p style={{ padding: '16px 18px', fontSize: 13, color: C.ink500 }}>No notes yet.</p>
        ) : (
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notes.map(note => (
              <div key={note.id} style={{ padding: '12px 14px', background: C.paper1, borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.ink800 }}>{note.authorLabel ?? 'Unknown'}</span>
                  <span style={{ fontSize: 11, color: C.ink500 }}>{new Date(note.createdAt).toLocaleString()}</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: C.ink900, whiteSpace: 'pre-wrap' }}>{note.body}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ─── Tab: Access ─────────────────────────────────────────────────────────────

function accessStatusVariant(status: string | null): 'ok' | 'info' | 'crit' | 'neutral' | 'warn' {
  if (!status) return 'neutral';
  if (status === 'provisioned') return 'ok';
  if (status === 'invited' || status === 'pending') return 'info';
  if (status === 'failed') return 'crit';
  return 'neutral'; // revoked, archived, suspend-pending
}

function AccessTab({ employeeId }: { employeeId: string }) {
  const [accounts, setAccounts] = useState<AccessAccountRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/atlas/employees/${employeeId}/access`);
    const data = await res.json();
    setAccounts(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(accountId: string, status: string) {
    await fetch(`/api/atlas/employees/${employeeId}/access/${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    load();
  }

  return (
    <Panel>
      <PanelHeader title="Access Accounts" />
      {loading ? (
        <p style={{ padding: '16px 18px', fontSize: 13, color: C.ink500 }}>Loading…</p>
      ) : accounts.length === 0 ? (
        <p style={{ padding: '16px 18px', fontSize: 13, color: C.ink500 }}>No access accounts provisioned.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.ink100}` }}>
                {['System', 'Status', 'External ID', 'Last Synced', 'Actions'].map((h, i) => (
                  <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.ink500, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map(acc => (
                <tr key={acc.id} style={{ borderBottom: `1px solid ${C.ink100}` }}>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{acc.system}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <Pill variant={accessStatusVariant(acc.status)} dot={false}>{acc.status ?? '—'}</Pill>
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: C.ink500 }}>{acc.externalId ?? '—'}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: C.ink500 }}>{fmtDate(acc.lastSyncedAt)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {acc.status !== 'provisioned' && acc.status !== 'revoked' && acc.status !== 'archived' && (
                        <Btn variant="primary" onClick={() => handleStatusChange(acc.id, 'provisioned')}>Provision</Btn>
                      )}
                      {acc.status !== 'revoked' && acc.status !== 'archived' && (
                        <Btn variant="crit" onClick={() => handleStatusChange(acc.id, 'revoked')}>Revoke</Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ─── Page root ───────────────────────────────────────────────────────────────

const TABS = ['Profile', 'Equipment', 'Cards', 'Workflow', 'Notes', 'Access'];

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const loadEmployee = useCallback(async () => {
    const res = await fetch(`/api/atlas/employees/${id}`);
    if (res.status === 404) { setNotFound(true); setLoading(false); return; }
    const data = await res.json() as EmployeeProfile;
    setEmployee(data);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadEmployee(); }, [loadEmployee]);

  if (loading) return <div style={{ padding: 32, color: C.ink500, fontSize: 13 }}>Loading…</div>;

  if (notFound || !employee) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.ink500 }}>
        Employee record not found.{' '}
        <button onClick={() => router.push('/atlas/employees')} style={{ color: C.info, background: 'none', border: 'none', cursor: 'pointer' }}>
          Back to Employees
        </button>
      </div>
    );
  }

  const latestRun = employee.runs[0];
  const isArchived = !!employee.deletedAt;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Back */}
      <button
        onClick={() => router.push('/atlas/employees')}
        style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.ink500, marginBottom: 16, padding: 0 }}
      >
        <ArrowLeft size={13} />
        Back to Employees
      </button>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <Avatar name={employee.name} size="lg" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.ink900 }}>{employee.name}</h1>
              {isArchived && <Pill variant="neutral" dot={false}>Archived</Pill>}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: C.ink500 }}>
              {employee.employeeCode}
              {employee.position ? ` · ${employee.position}` : ''}
              {employee.department ? ` · ${employee.department}` : ''}
              {employee.location ? ` · ${employee.location}` : ''}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {latestRun && (
            <Btn variant="outline" onClick={() => router.push(`/atlas/workflows/${latestRun.runId}`)}>
              <ExternalLink size={12} />
              Open workflow
            </Btn>
          )}
        </div>
      </div>

      {/* Archived banner */}
      {isArchived && (
        <div style={{ marginBottom: 16 }}>
          <Banner variant="warn" title={`This employee was archived on ${fmtDate(employee.deletedAt)}.`} />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.ink100}`, marginBottom: 20 }}>
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            style={{
              padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 13, fontWeight: activeTab === i ? 600 : 400,
              color: activeTab === i ? C.ink900 : C.ink500,
              borderBottom: activeTab === i ? `2px solid ${C.channel}` : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 0 && (
        <ProfileTab
          employee={employee}
          onArchive={loadEmployee}
          onUpdate={(fields) => setEmployee((prev) => prev ? { ...prev, ...fields } : prev)}
        />
      )}
      {activeTab === 1 && <EquipmentTab employeeId={id} />}
      {activeTab === 2 && <CardsTab employeeId={id} />}
      {activeTab === 3 && <WorkflowTab runs={employee.runs} />}
      {activeTab === 4 && <NotesTab employeeId={id} />}
      {activeTab === 5 && <AccessTab employeeId={id} />}
    </div>
  );
}
