'use client';

import React from 'react';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  bg?: string;
  color?: string;
}

const SIZE_MAP = { sm: 22, md: 28, lg: 44 };
const FONT_MAP = { sm: 9, md: 11, lg: 16 };

export function Avatar({ name, size = 'md', bg = '#EFE8DA', color = '#232F47' }: AvatarProps) {
  const px = SIZE_MAP[size];
  const fs = FONT_MAP[size];
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: px,
        height: px,
        borderRadius: '50%',
        backgroundColor: bg,
        color,
        fontSize: fs,
        fontWeight: 600,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {initials}
    </span>
  );
}
