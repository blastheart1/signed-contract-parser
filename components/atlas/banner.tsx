'use client';

import React from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

type BannerVariant = 'warn' | 'crit' | 'info';

interface BannerProps {
  variant: BannerVariant;
  title: string;
  body?: string;
  actions?: React.ReactNode;
}

const BANNER_STYLES: Record<BannerVariant, { bg: string; border: string; color: string; icon: React.ReactNode }> = {
  warn: {
    bg: '#FDF3DC',
    border: '#E8C84A',
    color: '#7A5A10',
    icon: <AlertTriangle size={16} color="#C29327" />,
  },
  crit: {
    bg: '#FDECEA',
    border: '#FE5834',
    color: '#B83318',
    icon: <AlertCircle size={16} color="#FE5834" />,
  },
  info: {
    bg: '#E8EEF7',
    border: '#7FA8D4',
    color: '#2E4F82',
    icon: <Info size={16} color="#466BA6" />,
  },
};

export function Banner({ variant, title, body, actions }: BannerProps) {
  const s = BANNER_STYLES[variant];
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        backgroundColor: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 8,
        padding: '10px 14px',
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 2 }}>{s.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: s.color }}>{title}</p>
        {body && <p style={{ margin: '2px 0 0', fontSize: 12, color: s.color, opacity: 0.85 }}>{body}</p>}
        {actions && <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>{actions}</div>}
      </div>
    </div>
  );
}
