// Atlas HR Onboarding/Offboarding — Types & Static Config

export type WorkflowStatus = 'pending' | 'in-progress' | 'blocked' | 'completed' | 'failed';
export type WorkflowType = 'onboarding' | 'offboarding';
export type SystemStatus =
  | 'provisioned'
  | 'invited'
  | 'pending'
  | 'failed'
  | 'suspend-pending'
  | 'revoked'
  | 'archived'
  | null;
export type StepStatus = 'queued' | 'active' | 'done' | 'blocked' | 'skipped' | 'failed';

export const ACCESS_MATRIX_SYSTEMS = [
  'Google Workspace',
  'Dropbox',
  'Trello',
  'Bill.com',
  'QuickBooks',
  'Trainual',
  'Fleet App',
] as const;

export type SystemKey = 'gmail' | 'dropbox' | 'trello' | 'billcom' | 'quickbooks' | 'trainual' | 'fleet';

export const SYSTEM_KEY_MAP: Record<string, SystemKey> = {
  'Google Workspace': 'gmail',
  'Dropbox': 'dropbox',
  'Trello': 'trello',
  'Bill.com': 'billcom',
  'QuickBooks': 'quickbooks',
  'Trainual': 'trainual',
  'Fleet App': 'fleet',
};

export interface StatusMeta {
  label: string;
  variant: 'ok' | 'warn' | 'crit' | 'info' | 'neutral';
  color: string;
}

export interface SystemStatusMeta {
  label: string;
  variant: 'ok' | 'warn' | 'crit' | 'info' | 'neutral';
}

export const STATUS_META: Record<WorkflowStatus, StatusMeta> = {
  'pending':     { label: 'Pending',     variant: 'neutral', color: '#6B7690' },
  'in-progress': { label: 'In Progress', variant: 'info',    color: '#466BA6' },
  'blocked':     { label: 'Blocked',     variant: 'warn',    color: '#C29327' },
  'completed':   { label: 'Completed',   variant: 'ok',      color: '#3E8E68' },
  'failed':      { label: 'Failed',      variant: 'crit',    color: '#FE5834' },
};

export const SYSTEM_STATUS_META: Record<string, SystemStatusMeta> = {
  'provisioned':     { label: 'Provisioned',   variant: 'ok'      },
  'invited':         { label: 'Invited',        variant: 'info'    },
  'pending':         { label: 'Pending',        variant: 'warn'    },
  'failed':          { label: 'Failed',         variant: 'crit'    },
  'suspend-pending': { label: 'Suspend queued', variant: 'warn'    },
  'revoked':         { label: 'Revoked',        variant: 'neutral' },
  'archived':        { label: 'Archived',       variant: 'neutral' },
};

// Dashboard row — shape returned by /api/atlas/workflow-runs
export interface DashboardRow {
  runId: string;
  runCode: string;
  type: WorkflowType;
  status: WorkflowStatus;
  ownerLabel: string | null;
  riskNote: string | null;
  startedAt: string | null;
  employeeId: string;
  name: string;
  position: string | null;
  department: string | null;
  location: string | null;
  managerName: string | null;
  startDate: string | null;
  companyEmail: string | null;
  employeeCode: string;
  progress: number;
  totalSteps: number;
  systems: Partial<Record<SystemKey, SystemStatus | null>>;
}

// Detailed run — returned by /api/atlas/workflow-runs/[id]
export interface RunDetail extends DashboardRow {
  steps: StepRow[];
  events: EventRow[];
  accessAccounts: AccessAccountRow[];
}

export interface StepRow {
  id: string;
  stepKey: string;
  phase: string | null;
  title: string;
  status: StepStatus;
  isManual: boolean;
  retryCount: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface EventRow {
  id: string;
  provider: string;
  eventType: string;
  status: string;
  httpStatus: number | null;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface AccessAccountRow {
  system: string;
  status: SystemStatus | null;
  externalId: string | null;
  lastSyncedAt: string | null;
}

// Role template — returned by /api/atlas/role-templates
export interface RoleTemplate {
  id: string;
  presetCode: string;
  label: string;
  department: string | null;
  entitlements: Record<string, boolean>;
}

// Dashboard metrics
export interface DashboardMetrics {
  activeOnboardings: number;
  activeOffboardings: number;
  requiresAttention: number;
  avgDaysToProductive: number | null;
  workflowSuccessRate: number | null;
}
