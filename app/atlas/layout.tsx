'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  UserMinus,
  PlayCircle,
  Settings,
  Shield,
  Bell,
  Search,
  LogOut,
} from 'lucide-react';
import { Avatar } from '@/components/atlas/avatar';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  channel:    '#232F47',
  avalon:     '#485568',
  santaFe:    '#F8F1E7',
  gold:       '#D79A2B',
  coral:      '#FE5834',
  ink900:     '#141A28',
  ink800:     '#232F47',
  ink500:     '#6B7690',
  ink300:     '#B7BECB',
  ink100:     '#E8EAF0',
  ink050:     '#F1F2F6',
  paper0:     '#FFFFFF',
  paper1:     '#FBF7EF',
  paper2:     '#F8F1E7',
  paper3:     '#EFE8DA',
  sidebarFg:  '#DFE4EF',
  sidebarDim: 'rgba(223,228,239,0.55)',
  sidebarDiv: 'rgba(255,255,255,0.08)',
};

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

interface SessionUser {
  id: number;
  username: string;
  email: string;
  role: string;
}

function buildNav(employeeCount: number | null): NavSection[] {
  return [
    {
      label: 'OPERATIONS',
      items: [
        { href: '/atlas', label: 'Dashboard', icon: <LayoutDashboard size={15} /> },
        {
          href: '/atlas/employees',
          label: 'Employees',
          icon: <Users size={15} />,
          ...(employeeCount !== null ? { badge: employeeCount } : {}),
        },
      ],
    },
    {
      label: 'WORKFLOWS',
      items: [
        { href: '/atlas/intake', label: 'New Hire', icon: <UserPlus size={15} /> },
        { href: '/atlas/offboarding', label: 'Offboarding', icon: <UserMinus size={15} /> },
        { href: '/atlas/workflows', label: 'Workflow Runs', icon: <PlayCircle size={15} /> },
      ],
    },
    {
      label: 'MANAGE',
      items: [
        { href: '/atlas/settings', label: 'Settings', icon: <Settings size={15} /> },
        { href: '/atlas/settings#permissions', label: 'Permissions', icon: <Shield size={15} /> },
      ],
    },
  ];
}

export default function AtlasLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [employeeCount, setEmployeeCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((data) => { if (data?.user) setSessionUser(data.user); })
      .catch(() => {});

    fetch('/api/atlas/employees/count')
      .then((r) => r.json())
      .then((data) => { if (typeof data?.count === 'number') setEmployeeCount(data.count); })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const NAV = buildNav(employeeCount);

  const isActive = (href: string) => {
    if (href === '/atlas') return pathname === '/atlas';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Oswald:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        .atlas-root * { box-sizing: border-box; }
        .atlas-root { font-family: 'Poppins', sans-serif; }
        .atlas-nav-item:hover { background: rgba(255,255,255,0.06) !important; }
        .atlas-btn:hover { opacity: 0.85; }
        .atlas-row:hover { background: #F7F8FB !important; cursor: pointer; }
      `}</style>

      <div
        className="atlas-root"
        style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: C.ink050 }}
      >
        {/* ─── Sidebar ─────────────────────────────────────────────────── */}
        <aside
          style={{
            width: 240,
            flexShrink: 0,
            background: C.channel,
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            overflow: 'hidden',
          }}
        >
          {/* Brand block */}
          <div
            style={{
              padding: '20px 18px 16px',
              borderBottom: `1px solid ${C.sidebarDiv}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: C.santaFe,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'Oswald, sans-serif',
                  fontWeight: 700,
                  fontSize: 16,
                  color: C.channel,
                  flexShrink: 0,
                }}
              >
                C
              </div>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontFamily: 'Oswald, sans-serif',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#FFFFFF',
                    letterSpacing: '0.08em',
                    lineHeight: 1.2,
                  }}
                >
                  CALIMINGO
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 10,
                    color: C.sidebarDim,
                    letterSpacing: '0.04em',
                  }}
                >
                  Atlas · Internal Ops
                </p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
            {NAV.map((section) => (
              <div key={section.label} style={{ marginBottom: 4 }}>
                <p
                  style={{
                    margin: '8px 18px 4px',
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'rgba(223,228,239,0.45)',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}
                >
                  {section.label}
                </p>
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="atlas-nav-item"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        padding: '7px 18px',
                        textDecoration: 'none',
                        borderRadius: 0,
                        color: active ? '#FFFFFF' : C.sidebarFg,
                        background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                        fontSize: 13,
                        fontWeight: active ? 600 : 400,
                        transition: 'background 0.15s',
                      }}
                    >
                      <span style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {item.badge !== undefined && (
                        <span
                          style={{
                            background: 'rgba(255,255,255,0.12)',
                            color: C.sidebarFg,
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: 10,
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div
            style={{
              padding: '12px 18px',
              borderTop: `1px solid ${C.sidebarDiv}`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Avatar name={sessionUser?.username ?? '?'} size="md" bg={C.gold} color="#FFFFFF" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#FFFFFF', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {sessionUser?.username ?? '—'}
              </p>
              <p style={{ margin: 0, fontSize: 10, color: C.sidebarDim, textTransform: 'capitalize' }}>{sessionUser?.role ?? ''}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Log out"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.6,
                flexShrink: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
            >
              <LogOut size={14} color={C.sidebarFg} />
            </button>
          </div>
        </aside>

        {/* ─── Main area ───────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Top bar */}
          <header
            style={{
              height: 52,
              flexShrink: 0,
              background: C.paper0,
              borderBottom: `1px solid ${C.ink100}`,
              display: 'flex',
              alignItems: 'center',
              padding: '0 20px',
              gap: 12,
            }}
          >
            {/* Breadcrumbs placeholder */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Link
                href="/atlas"
                style={{ fontSize: 12, color: C.ink500, textDecoration: 'none' }}
              >
                Atlas
              </Link>
            </div>

            {/* Search */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: C.ink050,
                border: `1px solid ${C.ink100}`,
                borderRadius: 6,
                padding: '0 10px',
                width: 220,
                height: 32,
              }}
            >
              <Search size={13} color={C.ink500} />
              <input
                placeholder="Search employees…"
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  fontSize: 12,
                  color: C.ink900,
                  outline: 'none',
                }}
              />
            </div>

            {/* Icon buttons */}
            <button
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                border: `1px solid ${C.ink100}`,
                background: C.paper0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bell size={14} color={C.ink500} />
            </button>
            <button
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                border: `1px solid ${C.ink100}`,
                background: C.paper0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Settings size={14} color={C.ink500} />
            </button>
          </header>

          {/* Page content */}
          <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
