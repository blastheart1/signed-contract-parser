import { db } from '@/lib/db';
import {
  atlasWorkflowRuns,
  atlasEmployees,
  atlasWorkflowSteps,
  atlasIntegrationEvents,
  atlasAccessAccounts,
  atlasRoleTemplates,
} from '@/lib/db/schema';
import { eq, desc, sql, inArray, count, or } from 'drizzle-orm';
import type {
  DashboardRow,
  RunDetail,
  DashboardMetrics,
  RoleTemplate,
  SystemKey,
  SystemStatus,
} from './data';
import { SYSTEM_KEY_MAP } from './data';

// ─── Helper ──────────────────────────────────────────────────────────────────

function toIso(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString();
}

// ─── getDashboardRows ─────────────────────────────────────────────────────────

export async function getDashboardRows(): Promise<DashboardRow[]> {
  const runs = await db
    .select({
      runId: atlasWorkflowRuns.id,
      runCode: atlasWorkflowRuns.runCode,
      type: atlasWorkflowRuns.type,
      status: atlasWorkflowRuns.status,
      ownerLabel: atlasWorkflowRuns.ownerLabel,
      riskNote: atlasWorkflowRuns.riskNote,
      startedAt: atlasWorkflowRuns.startedAt,
      employeeId: atlasEmployees.id,
      employeeCode: atlasEmployees.employeeCode,
      name: sql<string>`concat(${atlasEmployees.firstName}, ' ', ${atlasEmployees.lastName})`,
      position: atlasEmployees.position,
      department: atlasEmployees.department,
      location: atlasEmployees.location,
      managerName: atlasEmployees.managerName,
      startDate: atlasEmployees.startDate,
      companyEmail: atlasEmployees.companyEmail,
    })
    .from(atlasWorkflowRuns)
    .innerJoin(atlasEmployees, eq(atlasWorkflowRuns.employeeId, atlasEmployees.id))
    .orderBy(desc(atlasWorkflowRuns.createdAt));

  if (runs.length === 0) return [];

  const runIds = runs.map((r) => r.runId);
  const employeeIds = runs.map((r) => r.employeeId);

  const stepCounts = await db
    .select({
      runId: atlasWorkflowSteps.runId,
      total: count(),
      done: sql<number>`cast(count(*) filter (where ${atlasWorkflowSteps.status} = 'done') as int)`,
    })
    .from(atlasWorkflowSteps)
    .where(inArray(atlasWorkflowSteps.runId, runIds))
    .groupBy(atlasWorkflowSteps.runId);

  const stepMap = new Map<string, { total: number; done: number }>();
  for (const sc of stepCounts) {
    stepMap.set(sc.runId, { total: Number(sc.total), done: Number(sc.done) });
  }

  const accounts = await db
    .select({
      employeeId: atlasAccessAccounts.employeeId,
      system: atlasAccessAccounts.system,
      status: atlasAccessAccounts.status,
    })
    .from(atlasAccessAccounts)
    .where(inArray(atlasAccessAccounts.employeeId, employeeIds));

  const accountMap = new Map<string, Partial<Record<SystemKey, SystemStatus | null>>>();
  for (const acc of accounts) {
    const existing = accountMap.get(acc.employeeId) ?? {};
    const sysKey = SYSTEM_KEY_MAP[acc.system] as SystemKey | undefined;
    if (sysKey) {
      existing[sysKey] = (acc.status as SystemStatus) ?? null;
    }
    accountMap.set(acc.employeeId, existing);
  }

  return runs.map((r) => {
    const sc = stepMap.get(r.runId);
    return {
      runId: r.runId,
      runCode: r.runCode,
      type: r.type as DashboardRow['type'],
      status: r.status as DashboardRow['status'],
      ownerLabel: r.ownerLabel ?? null,
      riskNote: r.riskNote ?? null,
      startedAt: toIso(r.startedAt),
      employeeId: r.employeeId,
      name: r.name,
      position: r.position ?? null,
      department: r.department ?? null,
      location: r.location ?? null,
      managerName: r.managerName ?? null,
      startDate: toIso(r.startDate),
      companyEmail: r.companyEmail ?? null,
      employeeCode: r.employeeCode,
      progress: sc?.done ?? 0,
      totalSteps: sc?.total ?? 0,
      systems: accountMap.get(r.employeeId) ?? {},
    };
  });
}

// ─── getRunDetail ─────────────────────────────────────────────────────────────

export async function getRunDetail(runId: string): Promise<RunDetail | null> {
  const rows = await db
    .select({
      runId: atlasWorkflowRuns.id,
      runCode: atlasWorkflowRuns.runCode,
      type: atlasWorkflowRuns.type,
      status: atlasWorkflowRuns.status,
      ownerLabel: atlasWorkflowRuns.ownerLabel,
      riskNote: atlasWorkflowRuns.riskNote,
      startedAt: atlasWorkflowRuns.startedAt,
      employeeId: atlasEmployees.id,
      employeeCode: atlasEmployees.employeeCode,
      name: sql<string>`concat(${atlasEmployees.firstName}, ' ', ${atlasEmployees.lastName})`,
      position: atlasEmployees.position,
      department: atlasEmployees.department,
      location: atlasEmployees.location,
      managerName: atlasEmployees.managerName,
      startDate: atlasEmployees.startDate,
      companyEmail: atlasEmployees.companyEmail,
    })
    .from(atlasWorkflowRuns)
    .innerJoin(atlasEmployees, eq(atlasWorkflowRuns.employeeId, atlasEmployees.id))
    .where(eq(atlasWorkflowRuns.id, runId))
    .limit(1);

  if (rows.length === 0) return null;

  const r = rows[0];

  const [steps, events, accounts] = await Promise.all([
    db
      .select()
      .from(atlasWorkflowSteps)
      .where(eq(atlasWorkflowSteps.runId, runId))
      .orderBy(atlasWorkflowSteps.createdAt),
    db
      .select()
      .from(atlasIntegrationEvents)
      .where(eq(atlasIntegrationEvents.runId, runId))
      .orderBy(desc(atlasIntegrationEvents.createdAt)),
    db
      .select()
      .from(atlasAccessAccounts)
      .where(eq(atlasAccessAccounts.employeeId, r.employeeId)),
  ]);

  const doneCount = steps.filter((s) => s.status === 'done').length;

  const systemsMap: Partial<Record<SystemKey, SystemStatus | null>> = {};
  for (const acc of accounts) {
    const sysKey = SYSTEM_KEY_MAP[acc.system] as SystemKey | undefined;
    if (sysKey) {
      systemsMap[sysKey] = (acc.status as SystemStatus) ?? null;
    }
  }

  return {
    runId: r.runId,
    runCode: r.runCode,
    type: r.type as DashboardRow['type'],
    status: r.status as DashboardRow['status'],
    ownerLabel: r.ownerLabel ?? null,
    riskNote: r.riskNote ?? null,
    startedAt: toIso(r.startedAt),
    employeeId: r.employeeId,
    name: r.name,
    position: r.position ?? null,
    department: r.department ?? null,
    location: r.location ?? null,
    managerName: r.managerName ?? null,
    startDate: toIso(r.startDate),
    companyEmail: r.companyEmail ?? null,
    employeeCode: r.employeeCode,
    progress: doneCount,
    totalSteps: steps.length,
    systems: systemsMap,
    steps: steps.map((s) => ({
      id: s.id,
      stepKey: s.stepKey,
      phase: s.phase ?? null,
      title: s.title,
      status: s.status as RunDetail['steps'][number]['status'],
      isManual: s.isManual,
      retryCount: s.retryCount,
      errorMessage: s.errorMessage ?? null,
      startedAt: toIso(s.startedAt),
      completedAt: toIso(s.completedAt),
    })),
    events: events.map((e) => ({
      id: e.id,
      provider: e.provider,
      eventType: e.eventType,
      status: e.status,
      httpStatus: e.httpStatus ?? null,
      errorMessage: e.errorMessage ?? null,
      durationMs: e.durationMs ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
    accessAccounts: accounts.map((a) => ({
      system: a.system,
      status: (a.status as SystemStatus) ?? null,
      externalId: a.externalId ?? null,
      lastSyncedAt: toIso(a.lastSyncedAt),
    })),
  };
}

// ─── getDashboardMetrics ──────────────────────────────────────────────────────

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const ACTIVE = ['pending', 'in-progress', 'blocked'] as const;

  const [onboardingRows, offboardingRows, attentionRows, successRows] = await Promise.all([
    db
      .select({ cnt: count() })
      .from(atlasWorkflowRuns)
      .where(
        sql`${atlasWorkflowRuns.type} = 'onboarding' and ${atlasWorkflowRuns.status} in ('pending','in-progress','blocked')`,
      ),
    db
      .select({ cnt: count() })
      .from(atlasWorkflowRuns)
      .where(
        sql`${atlasWorkflowRuns.type} = 'offboarding' and ${atlasWorkflowRuns.status} in ('pending','in-progress','blocked')`,
      ),
    db
      .select({ cnt: count() })
      .from(atlasWorkflowRuns)
      .where(
        or(
          eq(atlasWorkflowRuns.status, 'blocked'),
          eq(atlasWorkflowRuns.status, 'failed'),
        ),
      ),
    db
      .select({
        completed: sql<number>`cast(count(*) filter (where ${atlasWorkflowRuns.status} = 'completed') as int)`,
        failed: sql<number>`cast(count(*) filter (where ${atlasWorkflowRuns.status} = 'failed') as int)`,
      })
      .from(atlasWorkflowRuns),
  ]);

  const completed = Number(successRows[0]?.completed ?? 0);
  const failed = Number(successRows[0]?.failed ?? 0);
  const total = completed + failed;
  const workflowSuccessRate = total > 0 ? Math.round((completed / total) * 1000) / 10 : null;

  return {
    activeOnboardings: Number(onboardingRows[0]?.cnt ?? 0),
    activeOffboardings: Number(offboardingRows[0]?.cnt ?? 0),
    requiresAttention: Number(attentionRows[0]?.cnt ?? 0),
    avgDaysToProductive: null,
    workflowSuccessRate,
  };
}

// ─── getRoleTemplates ─────────────────────────────────────────────────────────

export async function getRoleTemplates(): Promise<RoleTemplate[]> {
  const rows = await db
    .select()
    .from(atlasRoleTemplates)
    .where(eq(atlasRoleTemplates.isActive, true))
    .orderBy(atlasRoleTemplates.label);

  return rows.map((r) => ({
    id: r.id,
    presetCode: r.presetCode,
    label: r.label,
    department: r.department ?? null,
    entitlements: (r.entitlements as Record<string, boolean>) ?? {},
  }));
}

// ─── createEmployeeAndRun ─────────────────────────────────────────────────────

export interface CreateRunInput {
  firstName: string;
  lastName: string;
  personalEmail: string;
  phone: string;
  location: string;
  employmentType: string;
  position: string;
  department: string;
  managerName: string;
  startDate: string;
  companyEmailLocal: string;
  presetCode: string;
  entitlements: Record<string, boolean>;
}

const ONBOARDING_STEPS: Array<{ stepKey: string; phase: string; title: string; isManual: boolean }> = [
  { stepKey: 'validate_request',       phase: 'Pre-boarding', title: 'Validate hire request',                       isManual: true  },
  { stepKey: 'generate_email',          phase: 'Pre-boarding', title: 'Generate company email',                     isManual: false },
  { stepKey: 'google_create_user',      phase: 'Pre-boarding', title: 'Create Google Workspace account',            isManual: false },
  { stepKey: 'send_welcome_email',      phase: 'Pre-boarding', title: 'Send welcome email & document request',      isManual: false },
  { stepKey: 'trello_invite',           phase: 'Pre-boarding', title: 'Invite to Trello boards',                    isManual: false },
  { stepKey: 'trainual_invite',         phase: 'Pre-boarding', title: 'Invite to Trainual',                         isManual: false },
  { stepKey: 'calendar_placeholders',   phase: 'Pre-boarding', title: 'Create orientation calendar events',         isManual: false },
  { stepKey: 'send_access_info',        phase: 'Orientation',  title: 'Send access info email',                     isManual: false },
  { stepKey: 'orientation_welcome',     phase: 'Orientation',  title: 'Welcome & Orientation Overview',             isManual: true  },
  { stepKey: 'ceo_welcome',             phase: 'Orientation',  title: 'CEO Welcome Session',                        isManual: true  },
  { stepKey: 'it_orientation',          phase: 'Orientation',  title: 'IT Orientation',                             isManual: true  },
  { stepKey: 'accounting_orientation',  phase: 'Orientation',  title: 'Accounting Orientation (if applicable)',     isManual: true  },
  { stepKey: 'functional_orientation',  phase: 'Orientation',  title: 'Functional Orientation',                     isManual: true  },
  { stepKey: 'trainual_assign',         phase: 'Enablement',   title: 'Assign Trainual training plan',              isManual: false },
  { stepKey: 'billcom_notify',          phase: 'Enablement',   title: 'Notify accounting for Bill.com',             isManual: false },
];

export async function createEmployeeAndRun(
  data: CreateRunInput,
): Promise<{ employeeId: string; runId: string }> {
  const employeeCode = `E-${Date.now().toString().slice(-4)}`;
  const companyEmail = `${data.companyEmailLocal}@calimingo.com`;
  const startDateParsed = data.startDate ? new Date(data.startDate) : null;

  const [empRow] = await db
    .insert(atlasEmployees)
    .values({
      employeeCode,
      firstName: data.firstName,
      lastName: data.lastName,
      personalEmail: data.personalEmail || null,
      companyEmail,
      phone: data.phone || null,
      position: data.position || null,
      department: data.department || null,
      location: data.location || null,
      employmentType: data.employmentType || 'full-time',
      managerName: data.managerName || null,
      startDate: startDateParsed,
      accessPreset: data.presetCode || null,
    })
    .returning({ id: atlasEmployees.id });

  const employeeId = empRow.id;
  const runCode = `RUN-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

  const [runRow] = await db
    .insert(atlasWorkflowRuns)
    .values({
      runCode,
      employeeId,
      type: 'onboarding',
      status: 'pending',
    })
    .returning({ id: atlasWorkflowRuns.id });

  const runId = runRow.id;

  await db.insert(atlasWorkflowSteps).values(
    ONBOARDING_STEPS.map((s) => ({
      runId,
      stepKey: s.stepKey,
      phase: s.phase,
      title: s.title,
      status: 'queued' as const,
      isManual: s.isManual,
      retryCount: 0,
    })),
  );

  const accessEntries = Object.entries(data.entitlements)
    .filter(([, included]) => included)
    .map(([system]) => ({
      employeeId,
      system,
      status: 'pending' as const,
    }));

  if (accessEntries.length > 0) {
    await db.insert(atlasAccessAccounts).values(accessEntries);
  }

  return { employeeId, runId };
}
