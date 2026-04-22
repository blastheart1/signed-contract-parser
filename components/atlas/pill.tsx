'use client';

import React from 'react';

export type PillVariant = 'neutral' | 'ok' | 'warn' | 'crit' | 'info' | 'gold';

interface PillProps {
  variant?: PillVariant;
  dot?: boolean;
  size?: 'sm' | 'md';
  children: React.ReactNode;
}

const VARIANT_STYLES: Record<PillVariant, { bg: string; color: string; dot: string }> = {
  neutral: { bg: '#F1F2F6', color: '#6B7690', dot: '#B7BECB' },
  ok:      { bg: '#EAF4EF', color: '#2D6B4F', dot: '#3E8E68' },
  warn:    { bg: '#FDF3DC', color: '#7A5A10', dot: '#C29327' },
  crit:    { bg: '#FDECEA', color: '#B83318', dot: '#FE5834' },
  info:    { bg: '#E8EEF7', color: '#2E4F82', dot: '#466BA6' },
  gold:    { bg: '#FBF0D9', color: '#8B5E10', dot: '#D79A2B' },
};

export function Pill({ variant = 'neutral', dot = true, size = 'sm', children }: PillProps) {
  const s = VARIANT_STYLES[variant];
  const fontSize = size === 'sm' ? '11px' : '12px';
  const paddingX = size === 'sm' ? '7px' : '9px';
  const paddingY = size === 'sm' ? '2px' : '3px';
  const dotSize = size === 'sm' ? '5px' : '6px';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        backgroundColor: s.bg,
        color: s.color,
        fontSize,
        fontWeight: 500,
        lineHeight: '1.4',
        paddingLeft: paddingX,
        paddingRight: paddingX,
        paddingTop: paddingY,
        paddingBottom: paddingY,
        borderRadius: '20px',
        whiteSpace: 'nowrap',
      }}
    >
      {dot && (
        <span
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            backgroundColor: s.dot,
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}
