'use client';

import React from 'react';
import { Pill } from './pill';
import type { SystemStatus } from '@/lib/atlas/data';
import type { PillVariant } from './pill';

interface SysPillProps {
  status: SystemStatus;
  size?: 'sm' | 'md';
}

const STATUS_VARIANT: Record<NonNullable<SystemStatus>, PillVariant> = {
  provisioned:      'ok',
  invited:          'info',
  pending:          'neutral',
  failed:           'crit',
  'suspend-pending': 'warn',
  revoked:          'neutral',
  archived:         'neutral',
};

const STATUS_LABEL: Record<NonNullable<SystemStatus>, string> = {
  provisioned:      'Provisioned',
  invited:          'Invited',
  pending:          'Pending',
  failed:           'Failed',
  'suspend-pending': 'Suspend Pending',
  revoked:          'Revoked',
  archived:         'Archived',
};

export function SysPill({ status, size = 'sm' }: SysPillProps) {
  if (!status) {
    return (
      <span style={{ fontSize: 11, color: '#B7BECB' }}>—</span>
    );
  }
  return (
    <Pill variant={STATUS_VARIANT[status]} size={size}>
      {STATUS_LABEL[status]}
    </Pill>
  );
}
