'use client';

import React from 'react';
import { Pill } from './pill';
import type { WorkflowStatus } from '@/lib/atlas/data';
import type { PillVariant } from './pill';

interface StatusPillProps {
  status: WorkflowStatus;
  size?: 'sm' | 'md';
}

const STATUS_VARIANT: Record<WorkflowStatus, PillVariant> = {
  pending:      'neutral',
  'in-progress': 'info',
  blocked:      'warn',
  completed:    'ok',
  failed:       'crit',
};

const STATUS_LABEL: Record<WorkflowStatus, string> = {
  pending:      'Pending',
  'in-progress': 'In Progress',
  blocked:      'Blocked',
  completed:    'Completed',
  failed:       'Failed',
};

export function StatusPill({ status, size = 'sm' }: StatusPillProps) {
  return (
    <Pill variant={STATUS_VARIANT[status]} size={size}>
      {STATUS_LABEL[status]}
    </Pill>
  );
}
