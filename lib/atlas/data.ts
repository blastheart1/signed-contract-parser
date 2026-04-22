// Atlas HR Onboarding/Offboarding Data Types & Seed Data

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

export interface EmployeeSystems {
  gmail: SystemStatus;
  dropbox: SystemStatus;
  trello: SystemStatus;
  billcom: SystemStatus;
  quickbooks: SystemStatus;
  trainual: SystemStatus;
  fleet?: SystemStatus;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  position: string;
  dept: string;
  startDate: string;
  status: WorkflowStatus;
  progress: number;
  totalSteps: number;
  manager: string;
  location: string;
  type: WorkflowType;
  owner: string;
  risk: string | null;
  systems: EmployeeSystems;
}

export interface TimelineStep {
  id: string;
  phase: 'Pre-boarding' | 'Orientation' | 'Enablement';
  title: string;
  description: string;
  status: 'done' | 'active' | 'blocked' | 'queued';
  assignee: string;
  daysFromStart: number;
}

export interface WorkflowLogEntry {
  ts: string;
  lvl: 'info' | 'warn' | 'error' | 'ok';
  msg: string;
}

export interface AccessMatrixRole {
  role: string;
  access: boolean[];
}

export interface StatusMeta {
  label: string;
  variant: 'ok' | 'warn' | 'crit' | 'info' | 'neutral';
  color: string;
}

export interface SystemStatusMeta {
  label: string;
  variant: 'ok' | 'warn' | 'crit' | 'info' | 'neutral';
}

// ─── EMPLOYEES ───────────────────────────────────────────────────────────────

export const EMPLOYEES: Employee[] = [
  {
    id: 'E-2481',
    name: 'Marcelle Ortega',
    email: 'marcelle.ortega@calimingo.com',
    position: 'Pool Service Technician',
    dept: 'Operations',
    startDate: '2026-04-28',
    status: 'in-progress',
    progress: 6,
    totalSteps: 9,
    manager: 'Derek Hollis',
    location: 'Irvine, CA',
    type: 'onboarding',
    owner: 'HR—Lena Park',
    risk: null,
    systems: {
      gmail: 'provisioned',
      dropbox: 'provisioned',
      trello: 'provisioned',
      billcom: 'pending',
      quickbooks: null,
      trainual: 'invited',
    },
  },
  {
    id: 'E-2479',
    name: 'Jasmine Chu',
    email: 'jasmine.chu@calimingo.com',
    position: 'Regional Operations Lead',
    dept: 'Operations',
    startDate: '2026-04-21',
    status: 'blocked',
    progress: 4,
    totalSteps: 11,
    manager: 'Alana Reeves',
    location: 'San Diego, CA',
    type: 'onboarding',
    owner: 'IT—Vic Kaur',
    risk: 'Manager approval overdue · 3d',
    systems: {
      gmail: 'provisioned',
      dropbox: 'provisioned',
      trello: 'failed',
      billcom: 'pending',
      quickbooks: 'pending',
      trainual: 'pending',
    },
  },
  {
    id: 'E-2478',
    name: 'Priya Mehta',
    email: 'priya.mehta@calimingo.com',
    position: 'Staff Accountant',
    dept: 'Accounting',
    startDate: '2026-04-20',
    status: 'in-progress',
    progress: 7,
    totalSteps: 10,
    manager: 'Kate Hollister',
    location: 'Remote',
    type: 'onboarding',
    owner: 'Admin—Jo Bell',
    risk: null,
    systems: {
      gmail: 'provisioned',
      dropbox: 'provisioned',
      trello: 'provisioned',
      billcom: 'invited',
      quickbooks: 'pending',
      trainual: 'provisioned',
    },
  },
  {
    id: 'E-2477',
    name: 'Ben Achterberg',
    email: 'ben.achterberg@calimingo.com',
    position: 'Construction Foreman',
    dept: 'Construction',
    startDate: '2026-04-14',
    status: 'completed',
    progress: 9,
    totalSteps: 9,
    manager: 'Derek Hollis',
    location: 'Palm Springs, CA',
    type: 'onboarding',
    owner: 'HR—Lena Park',
    risk: null,
    systems: {
      gmail: 'provisioned',
      dropbox: 'provisioned',
      trello: 'provisioned',
      billcom: null,
      quickbooks: null,
      trainual: 'provisioned',
    },
  },
  {
    id: 'E-2471',
    name: 'Noor Saleh',
    email: 'noor.saleh@calimingo.com',
    position: 'Marketing Coordinator',
    dept: 'Marketing',
    startDate: '2026-04-08',
    status: 'completed',
    progress: 8,
    totalSteps: 8,
    manager: 'Eric Vinh',
    location: 'Los Angeles, CA',
    type: 'onboarding',
    owner: 'Admin—Jo Bell',
    risk: null,
    systems: {
      gmail: 'provisioned',
      dropbox: 'provisioned',
      trello: 'provisioned',
      billcom: null,
      quickbooks: null,
      trainual: 'provisioned',
    },
  },
  {
    id: 'E-2469',
    name: 'Rafael Bustamante',
    email: 'rafael.bustamante@calimingo.com',
    position: 'Service Technician',
    dept: 'Operations',
    startDate: '2026-05-05',
    status: 'pending',
    progress: 1,
    totalSteps: 9,
    manager: 'Derek Hollis',
    location: 'Orange County, CA',
    type: 'onboarding',
    owner: 'HR—Lena Park',
    risk: null,
    systems: {
      gmail: null,
      dropbox: null,
      trello: null,
      billcom: null,
      quickbooks: null,
      trainual: null,
    },
  },
  {
    id: 'E-2133',
    name: 'Harper Ingraham',
    email: 'harper.ingraham@calimingo.com',
    position: 'Project Estimator',
    dept: 'Construction',
    startDate: '2026-04-30',
    status: 'in-progress',
    progress: 4,
    totalSteps: 7,
    manager: 'Alana Reeves',
    location: 'Newport Beach, CA',
    type: 'offboarding',
    owner: 'IT—Vic Kaur',
    risk: 'Device unreturned',
    systems: {
      gmail: 'suspend-pending',
      dropbox: 'suspend-pending',
      trello: 'revoked',
      billcom: 'revoked',
      quickbooks: 'revoked',
      trainual: 'revoked',
    },
  },
  {
    id: 'E-2045',
    name: 'Trevor Okafor',
    email: 'trevor.okafor@calimingo.com',
    position: 'Sales Consultant',
    dept: 'Sales',
    startDate: '2026-04-12',
    status: 'completed',
    progress: 6,
    totalSteps: 6,
    manager: 'Kate Hollister',
    location: 'Remote',
    type: 'offboarding',
    owner: 'HR—Lena Park',
    risk: null,
    systems: {
      gmail: 'archived',
      dropbox: 'archived',
      trello: 'revoked',
      billcom: null,
      quickbooks: null,
      trainual: 'revoked',
    },
  },
  {
    id: 'E-2480',
    name: 'Luis Arredondo',
    email: 'luis.arredondo@calimingo.com',
    position: 'Warranty Coordinator',
    dept: 'Service',
    startDate: '2026-04-22',
    status: 'failed',
    progress: 3,
    totalSteps: 9,
    manager: 'Eric Vinh',
    location: 'Anaheim, CA',
    type: 'onboarding',
    owner: 'IT—Vic Kaur',
    risk: 'Workspace invite bounced',
    systems: {
      gmail: 'failed',
      dropbox: 'pending',
      trello: 'pending',
      billcom: null,
      quickbooks: null,
      trainual: null,
    },
  },
  {
    id: 'E-2475',
    name: 'Sloane Petterson',
    email: 'sloane.petterson@calimingo.com',
    position: 'HR Generalist',
    dept: 'People Ops',
    startDate: '2026-04-17',
    status: 'in-progress',
    progress: 5,
    totalSteps: 10,
    manager: 'Lena Park',
    location: 'Remote',
    type: 'onboarding',
    owner: 'Admin—Jo Bell',
    risk: null,
    systems: {
      gmail: 'provisioned',
      dropbox: 'provisioned',
      trello: 'provisioned',
      billcom: null,
      quickbooks: 'invited',
      trainual: 'provisioned',
    },
  },
];

// ─── TIMELINE TEMPLATE ───────────────────────────────────────────────────────

export const TIMELINE_TEMPLATE: TimelineStep[] = [
  // Pre-boarding (days -14 to -1)
  {
    id: 'tl-01',
    phase: 'Pre-boarding',
    title: 'Send offer letter',
    description: 'Docusign template dispatched to personal email',
    status: 'done',
    assignee: 'HR—Lena Park',
    daysFromStart: -14,
  },
  {
    id: 'tl-02',
    phase: 'Pre-boarding',
    title: 'Collect I-9 documents',
    description: 'Identity & employment eligibility verification',
    status: 'done',
    assignee: 'HR—Lena Park',
    daysFromStart: -10,
  },
  {
    id: 'tl-03',
    phase: 'Pre-boarding',
    title: 'Provision Google Workspace',
    description: 'Create @calimingo.com account and set up Groups',
    status: 'done',
    assignee: 'IT—Vic Kaur',
    daysFromStart: -7,
  },
  {
    id: 'tl-04',
    phase: 'Pre-boarding',
    title: 'Ship hardware (if applicable)',
    description: 'Laptop + peripherals shipped to home address',
    status: 'done',
    assignee: 'IT—Vic Kaur',
    daysFromStart: -7,
  },
  {
    id: 'tl-05',
    phase: 'Pre-boarding',
    title: 'Manager intro email',
    description: 'Welcome message sent from hiring manager',
    status: 'done',
    assignee: 'Manager',
    daysFromStart: -3,
  },
  // Orientation (days 0 to 3)
  {
    id: 'tl-06',
    phase: 'Orientation',
    title: 'Day-1 onboarding session',
    description: 'Company overview, culture, and tools walkthrough',
    status: 'done',
    assignee: 'HR—Lena Park',
    daysFromStart: 0,
  },
  {
    id: 'tl-07',
    phase: 'Orientation',
    title: 'Benefits enrollment',
    description: 'Complete benefits selections in Gusto',
    status: 'active',
    assignee: 'Employee',
    daysFromStart: 1,
  },
  {
    id: 'tl-08',
    phase: 'Orientation',
    title: 'Meet key stakeholders',
    description: 'Introductory 1:1s with cross-functional team leads',
    status: 'queued',
    assignee: 'Manager',
    daysFromStart: 2,
  },
  {
    id: 'tl-09',
    phase: 'Orientation',
    title: 'Complete Trainual modules',
    description: 'Finish assigned role-specific training content',
    status: 'queued',
    assignee: 'Employee',
    daysFromStart: 3,
  },
  // Enablement (days 7 to 30)
  {
    id: 'tl-10',
    phase: 'Enablement',
    title: 'System access audit',
    description: 'Confirm all provisioned tools are accessible',
    status: 'queued',
    assignee: 'IT—Vic Kaur',
    daysFromStart: 7,
  },
  {
    id: 'tl-11',
    phase: 'Enablement',
    title: 'Set 30-day goals',
    description: 'Manager and employee align on OKRs and milestones',
    status: 'queued',
    assignee: 'Manager',
    daysFromStart: 7,
  },
  {
    id: 'tl-12',
    phase: 'Enablement',
    title: 'Payroll first run verification',
    description: 'Confirm employee appears on first pay cycle',
    status: 'queued',
    assignee: 'Admin—Jo Bell',
    daysFromStart: 14,
  },
  {
    id: 'tl-13',
    phase: 'Enablement',
    title: '2-week check-in',
    description: 'Informal pulse check with HR',
    status: 'queued',
    assignee: 'HR—Lena Park',
    daysFromStart: 14,
  },
  {
    id: 'tl-14',
    phase: 'Enablement',
    title: '30-day review',
    description: 'Formal progress review with manager',
    status: 'queued',
    assignee: 'Manager',
    daysFromStart: 30,
  },
  {
    id: 'tl-15',
    phase: 'Enablement',
    title: 'Close onboarding workflow',
    description: 'Mark workflow complete and archive in Atlas',
    status: 'queued',
    assignee: 'HR—Lena Park',
    daysFromStart: 30,
  },
];

// ─── WORKFLOW LOG ─────────────────────────────────────────────────────────────

export const WORKFLOW_LOG: WorkflowLogEntry[] = [
  { ts: '2026-04-22T08:00:14Z', lvl: 'info', msg: 'Workflow RUN-2026-0481 initiated for E-2481 Marcelle Ortega' },
  { ts: '2026-04-22T08:00:15Z', lvl: 'ok',   msg: 'Step 1 complete — Offer letter Docusign dispatched' },
  { ts: '2026-04-22T08:00:18Z', lvl: 'ok',   msg: 'Step 2 complete — I-9 document request sent' },
  { ts: '2026-04-22T08:01:02Z', lvl: 'ok',   msg: 'Step 3 complete — Google Workspace account provisioned (marcelle.ortega@calimingo.com)' },
  { ts: '2026-04-22T08:03:44Z', lvl: 'ok',   msg: 'Step 4 complete — Dropbox access granted via group rule' },
  { ts: '2026-04-22T08:03:45Z', lvl: 'ok',   msg: 'Step 5 complete — Trello board invitation sent' },
  { ts: '2026-04-22T08:04:01Z', lvl: 'warn', msg: 'Step 6 — Trainual invite bounced (first attempt). Retrying in 60s.' },
  { ts: '2026-04-22T08:05:01Z', lvl: 'ok',   msg: 'Step 6 complete — Trainual invite resent and accepted' },
  { ts: '2026-04-22T08:05:03Z', lvl: 'info', msg: 'Step 7 — Bill.com invite pending manager approval (Derek Hollis)' },
  { ts: '2026-04-22T08:05:03Z', lvl: 'info', msg: 'Workflow paused — awaiting human action on Step 7' },
  { ts: '2026-04-22T08:17:23Z', lvl: 'info', msg: 'Elapsed time: 17m 23s · Steps complete: 7/15 · Retries: 1' },
];

// ─── ACCESS MATRIX ────────────────────────────────────────────────────────────

export const ACCESS_MATRIX_SYSTEMS = [
  'Google Workspace',
  'Dropbox',
  'Trello',
  'Bill.com',
  'QuickBooks',
  'Trainual',
  'Fleet App',
];

export const ACCESS_MATRIX: AccessMatrixRole[] = [
  { role: 'Pool Service Technician', access: [true,  true,  true,  false, false, true,  true]  },
  { role: 'Construction Foreman',    access: [true,  true,  true,  false, false, true,  false] },
  { role: 'Regional Ops Lead',       access: [true,  true,  true,  true,  false, true,  true]  },
  { role: 'Staff Accountant',        access: [true,  true,  true,  true,  true,  true,  false] },
  { role: 'Marketing Coordinator',   access: [true,  true,  true,  false, false, true,  false] },
  { role: 'HR Generalist',           access: [true,  true,  true,  false, false, true,  false] },
  { role: 'Sales Consultant',        access: [true,  true,  true,  false, false, true,  false] },
  { role: 'Warranty Coordinator',    access: [true,  true,  false, false, false, true,  false] },
  { role: 'Project Estimator',       access: [true,  true,  true,  true,  false, true,  false] },
];

// ─── STATUS META ──────────────────────────────────────────────────────────────

export const STATUS_META: Record<WorkflowStatus, StatusMeta> = {
  'pending':     { label: 'Pending',     variant: 'neutral', color: '#6B7690' },
  'in-progress': { label: 'In Progress', variant: 'info',    color: '#466BA6' },
  'blocked':     { label: 'Blocked',     variant: 'warn',    color: '#C29327' },
  'completed':   { label: 'Completed',   variant: 'ok',      color: '#3E8E68' },
  'failed':      { label: 'Failed',      variant: 'crit',    color: '#FE5834' },
};

export const SYSTEM_STATUS_META: Record<NonNullable<SystemStatus>, SystemStatusMeta> = {
  'provisioned':     { label: 'Provisioned',     variant: 'ok'      },
  'invited':         { label: 'Invited',          variant: 'info'    },
  'pending':         { label: 'Pending',          variant: 'neutral' },
  'failed':          { label: 'Failed',           variant: 'crit'    },
  'suspend-pending': { label: 'Suspend Pending',  variant: 'warn'    },
  'revoked':         { label: 'Revoked',          variant: 'neutral' },
  'archived':        { label: 'Archived',         variant: 'neutral' },
};
