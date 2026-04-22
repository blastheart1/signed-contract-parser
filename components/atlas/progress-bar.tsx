'use client';

import React from 'react';
import type { WorkflowStatus } from '@/lib/atlas/data';

interface ProgressBarProps {
  pct: number;
  status?: WorkflowStatus;
  width?: number;
}

const STATUS_COLOR: Record<WorkflowStatus, string> = {
  pending:      '#B7BECB',
  'in-progress': '#466BA6',
  blocked:      '#C29327',
  completed:    '#3E8E68',
  failed:       '#FE5834',
};

export function ProgressBar({ pct, status = 'in-progress', width = 88 }: ProgressBarProps) {
  const fill = Math.min(100, Math.max(0, pct));
  const color = STATUS_COLOR[status];

  return (
    <div
      style={{
        width,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#E8EAF0',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: `${fill}%`,
          height: '100%',
          borderRadius: 3,
          backgroundColor: color,
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}
