import { db } from '@/lib/db';
import {
  atlasWorkflowRuns,
  atlasEmployees,
  atlasWorkflowSteps,
  atlasIntegrationEvents,
  atlasAccessAccounts,
  atlasRoleTemplates,
  atlasNotes,
  atlasEquipment,
  atlasCards,
} from '@/lib/db/schema';
import { eq, desc, sql, inArray, count, or, isNull, and, ilike } from 'drizzle-orm';
import { encryptSalary } from './crypto';
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

  const avgDaysRows = await db
    .select({
      avgDays: sql<number>`round(avg(extract(epoch from (${atlasWorkflowRuns.completedAt} - ${atlasWorkflowRuns.startedAt})) / 86400.0)::numeric, 1)`,
    })
    .from(atlasWorkflowRuns)
    .where(
      sql`${atlasWorkflowRuns.type} = 'onboarding'
        and ${atlasWorkflowRuns.status} = 'completed'
        and ${atlasWorkflowRuns.completedAt} is not null
        and ${atlasWorkflowRuns.startedAt} is not null
        and ${atlasWorkflowRuns.completedAt} >= now() - interval '90 days'`,
    );

  const avgDays =
    avgDaysRows[0]?.avgDays != null ? Number(avgDaysRows[0].avgDays) : null;

  return {
    activeOnboardings: Number(onboardingRows[0]?.cnt ?? 0),
    activeOffboardings: Number(offboardingRows[0]?.cnt ?? 0),
    requiresAttention: Number(attentionRows[0]?.cnt ?? 0),
    avgDaysToProductive: avgDays,
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
  compensation?: string;
  compensationVisible?: string;
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
      salaryEncrypted: data.compensation ? encryptSalary(data.compensation) : null,
      compVisibility: data.compensationVisible ?? 'restricted',
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

// ─── getEmployeeList ──────────────────────────────────────────────────────────

export interface EmployeeListRow {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  name: string;
  companyEmail: string | null;
  position: string | null;
  department: string | null;
  location: string | null;
  employmentType: string | null;
  startDate: string | null;
  accessPreset: string | null;
  deletedAt: string | null;
  activeRunStatus: string | null;
  activeRunId: string | null;
}

export interface GetEmployeeListOptions {
  includeArchived?: boolean;
  search?: string;
  department?: string;
  page?: number;
  limit?: number;
}

export async function getEmployeeList(
  includeArchivedOrOptions: boolean | GetEmployeeListOptions = false,
): Promise<{ employees: EmployeeListRow[]; total: number }> {
  const opts: GetEmployeeListOptions =
    typeof includeArchivedOrOptions === 'boolean'
      ? { includeArchived: includeArchivedOrOptions }
      : includeArchivedOrOptions;

  const { includeArchived = false, search, department, page = 1, limit = 50 } = opts;

  const conditions = [];
  if (!includeArchived) conditions.push(isNull(atlasEmployees.deletedAt));
  if (department) conditions.push(eq(atlasEmployees.department, department));
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(sql<string>`concat(${atlasEmployees.firstName}, ' ', ${atlasEmployees.lastName})`, pattern),
        ilike(atlasEmployees.employeeCode, pattern),
      )!,
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const selectFields = {
    id: atlasEmployees.id,
    employeeCode: atlasEmployees.employeeCode,
    firstName: atlasEmployees.firstName,
    lastName: atlasEmployees.lastName,
    companyEmail: atlasEmployees.companyEmail,
    position: atlasEmployees.position,
    department: atlasEmployees.department,
    location: atlasEmployees.location,
    employmentType: atlasEmployees.employmentType,
    startDate: atlasEmployees.startDate,
    accessPreset: atlasEmployees.accessPreset,
    deletedAt: atlasEmployees.deletedAt,
    activeRunId: sql<string | null>`(
      SELECT id FROM atlas_workflow_runs
      WHERE employee_id = ${atlasEmployees.id}
      ORDER BY created_at DESC LIMIT 1
    )`.as('active_run_id'),
    activeRunStatus: sql<string | null>`(
      SELECT status FROM atlas_workflow_runs
      WHERE employee_id = ${atlasEmployees.id}
      ORDER BY created_at DESC LIMIT 1
    )`.as('active_run_status'),
  };

  const [employees, totalRows] = await Promise.all([
    db
      .select(selectFields)
      .from(atlasEmployees)
      .where(whereClause)
      .orderBy(desc(atlasEmployees.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ cnt: count() })
      .from(atlasEmployees)
      .where(whereClause),
  ]);

  const total = Number(totalRows[0]?.cnt ?? 0);

  return {
    employees: employees.map((e) => ({
      id: e.id,
      employeeCode: e.employeeCode,
      firstName: e.firstName,
      lastName: e.lastName,
      name: `${e.firstName} ${e.lastName}`,
      companyEmail: e.companyEmail ?? null,
      position: e.position ?? null,
      department: e.department ?? null,
      location: e.location ?? null,
      employmentType: e.employmentType ?? null,
      startDate: toIso(e.startDate),
      accessPreset: e.accessPreset ?? null,
      deletedAt: toIso(e.deletedAt),
      activeRunStatus: e.activeRunStatus ?? null,
      activeRunId: e.activeRunId ?? null,
    })),
    total,
  };
}

// ─── getEmployeeProfile ───────────────────────────────────────────────────────

export interface EmployeeProfile {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  name: string;
  personalEmail: string | null;
  companyEmail: string | null;
  phone: string | null;
  position: string | null;
  department: string | null;
  location: string | null;
  employmentType: string | null;
  managerName: string | null;
  startDate: string | null;
  endDate: string | null;
  accessPreset: string | null;
  deletedAt: string | null;
  runs: Array<{ runId: string; runCode: string; type: string; status: string; startedAt: string | null }>;
}

export async function getEmployeeProfile(employeeId: string): Promise<EmployeeProfile | null> {
  const rows = await db
    .select()
    .from(atlasEmployees)
    .where(eq(atlasEmployees.id, employeeId))
    .limit(1);

  if (rows.length === 0) return null;
  const e = rows[0];

  const runs = await db
    .select({
      runId: atlasWorkflowRuns.id,
      runCode: atlasWorkflowRuns.runCode,
      type: atlasWorkflowRuns.type,
      status: atlasWorkflowRuns.status,
      startedAt: atlasWorkflowRuns.startedAt,
    })
    .from(atlasWorkflowRuns)
    .where(eq(atlasWorkflowRuns.employeeId, employeeId))
    .orderBy(desc(atlasWorkflowRuns.createdAt));

  return {
    id: e.id,
    employeeCode: e.employeeCode,
    firstName: e.firstName,
    lastName: e.lastName,
    name: `${e.firstName} ${e.lastName}`,
    personalEmail: e.personalEmail ?? null,
    companyEmail: e.companyEmail ?? null,
    phone: e.phone ?? null,
    position: e.position ?? null,
    department: e.department ?? null,
    location: e.location ?? null,
    employmentType: e.employmentType ?? null,
    managerName: e.managerName ?? null,
    startDate: toIso(e.startDate),
    endDate: toIso(e.endDate),
    accessPreset: e.accessPreset ?? null,
    deletedAt: toIso(e.deletedAt),
    runs: runs.map((r) => ({
      runId: r.runId,
      runCode: r.runCode,
      type: r.type,
      status: r.status,
      startedAt: toIso(r.startedAt),
    })),
  };
}

// ─── getManagerCandidates ─────────────────────────────────────────────────────

export interface ManagerCandidate {
  id: string;
  name: string;
  position: string | null;
  department: string | null;
}

export async function getManagerCandidates(): Promise<ManagerCandidate[]> {
  const rows = await db
    .select({
      id: atlasEmployees.id,
      name: sql<string>`concat(${atlasEmployees.firstName}, ' ', ${atlasEmployees.lastName})`,
      position: atlasEmployees.position,
      department: atlasEmployees.department,
    })
    .from(atlasEmployees)
    .where(isNull(atlasEmployees.deletedAt))
    .orderBy(
      sql`concat(${atlasEmployees.firstName}, ' ', ${atlasEmployees.lastName})`,
    );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    position: r.position ?? null,
    department: r.department ?? null,
  }));
}

// ─── archiveEmployee / restoreEmployee ───────────────────────────────────────

export async function archiveEmployee(employeeId: string) {
  await db
    .update(atlasEmployees)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(atlasEmployees.id, employeeId));
}

export async function restoreEmployee(employeeId: string) {
  await db
    .update(atlasEmployees)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(atlasEmployees.id, employeeId));
}

// ─── updateEmployee ──────────────────────────────────────────────────────────

export interface UpdateEmployeeFields {
  firstName?: string;
  lastName?: string;
  personalEmail?: string;
  phone?: string;
  position?: string;
  department?: string;
  managerName?: string;
  location?: string;
  employmentType?: string;
}

export async function updateEmployee(employeeId: string, fields: UpdateEmployeeFields) {
  await db
    .update(atlasEmployees)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(atlasEmployees.id, employeeId));
}

// ─── Equipment ───────────────────────────────────────────────────────────────

export interface EquipmentRow {
  id: string;
  employeeId: string;
  type: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  assetTag: string | null;
  condition: string;
  notes: string | null;
  assignedAt: string;
  returnedAt: string | null;
}

export async function getEquipment(employeeId: string): Promise<EquipmentRow[]> {
  const rows = await db
    .select()
    .from(atlasEquipment)
    .where(eq(atlasEquipment.employeeId, employeeId))
    .orderBy(desc(atlasEquipment.assignedAt));

  return rows.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    type: r.type,
    brand: r.brand ?? null,
    model: r.model ?? null,
    serialNumber: r.serialNumber ?? null,
    assetTag: r.assetTag ?? null,
    condition: r.condition,
    notes: r.notes ?? null,
    assignedAt: r.assignedAt.toISOString(),
    returnedAt: r.returnedAt ? r.returnedAt.toISOString() : null,
  }));
}

export interface AddEquipmentInput {
  type: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  assetTag?: string;
  condition?: string;
  notes?: string;
}

export async function addEquipment(employeeId: string, data: AddEquipmentInput): Promise<EquipmentRow> {
  const [row] = await db
    .insert(atlasEquipment)
    .values({ employeeId, ...data })
    .returning();
  return {
    id: row.id,
    employeeId: row.employeeId,
    type: row.type,
    brand: row.brand ?? null,
    model: row.model ?? null,
    serialNumber: row.serialNumber ?? null,
    assetTag: row.assetTag ?? null,
    condition: row.condition,
    notes: row.notes ?? null,
    assignedAt: row.assignedAt.toISOString(),
    returnedAt: row.returnedAt ? row.returnedAt.toISOString() : null,
  };
}

export async function removeEquipment(equipmentId: string) {
  await db.delete(atlasEquipment).where(eq(atlasEquipment.id, equipmentId));
}

export async function returnEquipment(equipmentId: string) {
  await db
    .update(atlasEquipment)
    .set({ returnedAt: new Date(), condition: 'returned' })
    .where(eq(atlasEquipment.id, equipmentId));
}

// ─── Cards ────────────────────────────────────────────────────────────────────

export interface CardRow {
  id: string;
  employeeId: string;
  cardholderName: string;
  last4: string | null;
  issuer: string;
  creditLimit: number | null;
  currency: string;
  supplementaryTo: string | null;
  primaryOwnerName: string | null;
  status: string;
  assignedAt: string;
  cancelledAt: string | null;
  notes: string | null;
}

export async function getCards(employeeId: string): Promise<CardRow[]> {
  const rows = await db
    .select()
    .from(atlasCards)
    .where(eq(atlasCards.employeeId, employeeId))
    .orderBy(desc(atlasCards.assignedAt));

  return rows.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    cardholderName: r.cardholderName,
    last4: r.last4 ?? null,
    issuer: r.issuer,
    creditLimit: r.creditLimit ?? null,
    currency: r.currency,
    supplementaryTo: r.supplementaryTo ?? null,
    primaryOwnerName: r.primaryOwnerName ?? null,
    status: r.status,
    assignedAt: r.assignedAt.toISOString(),
    cancelledAt: r.cancelledAt ? r.cancelledAt.toISOString() : null,
    notes: r.notes ?? null,
  }));
}

export interface AddCardInput {
  cardholderName: string;
  last4?: string;
  issuer?: string;
  creditLimit?: number;
  currency?: string;
  supplementaryTo?: string;
  primaryOwnerName?: string;
  notes?: string;
}

export async function addCard(employeeId: string, data: AddCardInput): Promise<CardRow> {
  const [row] = await db
    .insert(atlasCards)
    .values({ employeeId, ...data })
    .returning();
  return {
    id: row.id,
    employeeId: row.employeeId,
    cardholderName: row.cardholderName,
    last4: row.last4 ?? null,
    issuer: row.issuer,
    creditLimit: row.creditLimit ?? null,
    currency: row.currency,
    supplementaryTo: row.supplementaryTo ?? null,
    primaryOwnerName: row.primaryOwnerName ?? null,
    status: row.status,
    assignedAt: row.assignedAt.toISOString(),
    cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
    notes: row.notes ?? null,
  };
}

export async function updateCardStatus(cardId: string, status: 'active' | 'suspended' | 'cancelled') {
  await db
    .update(atlasCards)
    .set({ status, ...(status === 'cancelled' ? { cancelledAt: new Date() } : {}), updatedAt: new Date() })
    .where(eq(atlasCards.id, cardId));
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export interface NoteRow {
  id: string;
  employeeId: string;
  runId: string | null;
  authorLabel: string | null;
  body: string;
  createdAt: string;
}

export async function getNotes(employeeId: string): Promise<NoteRow[]> {
  const rows = await db
    .select()
    .from(atlasNotes)
    .where(eq(atlasNotes.employeeId, employeeId))
    .orderBy(desc(atlasNotes.createdAt));

  return rows.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    runId: r.runId ?? null,
    authorLabel: r.authorLabel ?? null,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function saveNote(employeeId: string, body: string, authorLabel: string, runId?: string): Promise<NoteRow> {
  const [row] = await db
    .insert(atlasNotes)
    .values({ employeeId, body, authorLabel, runId: runId ?? null })
    .returning();
  return {
    id: row.id,
    employeeId: row.employeeId,
    runId: row.runId ?? null,
    authorLabel: row.authorLabel ?? null,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

// ─── Access Accounts ─────────────────────────────────────────────────────────

export interface AccessAccountRow {
  id: string;
  employeeId: string;
  system: string;
  status: string | null;
  externalId: string | null;
  lastSyncedAt: string | null;
  provisionedAt: string | null;
  revokedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getAccessAccounts(employeeId: string): Promise<AccessAccountRow[]> {
  const rows = await db
    .select()
    .from(atlasAccessAccounts)
    .where(eq(atlasAccessAccounts.employeeId, employeeId))
    .orderBy(atlasAccessAccounts.system);

  return rows.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    system: r.system,
    status: r.status ?? null,
    externalId: r.externalId ?? null,
    lastSyncedAt: toIso(r.lastSyncedAt),
    provisionedAt: toIso(r.provisionedAt),
    revokedAt: toIso(r.revokedAt),
    notes: r.notes ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function updateAccessAccountStatus(id: string, status: string) {
  await db
    .update(atlasAccessAccounts)
    .set({ status: status as typeof atlasAccessAccounts.$inferInsert['status'], updatedAt: new Date() })
    .where(eq(atlasAccessAccounts.id, id));
}

// ─── createOffboardingRun ─────────────────────────────────────────────────────

const OFFBOARDING_STEPS: Array<{ stepKey: string; title: string; phase: string; isManual: boolean; order: number }> = [
  { stepKey: 'notify_hr',         title: 'Notify HR & manager',            phase: 'Preparation', isManual: true,  order: 1 },
  { stepKey: 'revoke_google',     title: 'Revoke Google Workspace access',  phase: 'Access',      isManual: false, order: 2 },
  { stepKey: 'revoke_systems',    title: 'Revoke all system access',        phase: 'Access',      isManual: false, order: 3 },
  { stepKey: 'collect_equipment', title: 'Collect equipment & devices',     phase: 'Assets',      isManual: true,  order: 4 },
  { stepKey: 'final_payroll',     title: 'Process final payroll',           phase: 'Finance',     isManual: true,  order: 5 },
  { stepKey: 'exit_interview',    title: 'Conduct exit interview',          phase: 'HR',          isManual: true,  order: 6 },
  { stepKey: 'archive_employee',  title: 'Archive employee record',         phase: 'HR',          isManual: false, order: 7 },
];

export async function createOffboardingRun(employeeId: string): Promise<string> {
  const runCode = `OFF-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

  const [runRow] = await db
    .insert(atlasWorkflowRuns)
    .values({
      runCode,
      employeeId,
      type: 'offboarding',
      status: 'pending',
    })
    .returning({ id: atlasWorkflowRuns.id });

  const runId = runRow.id;

  await db.insert(atlasWorkflowSteps).values(
    OFFBOARDING_STEPS.map((s) => ({
      runId,
      stepKey: s.stepKey,
      phase: s.phase,
      title: s.title,
      status: 'queued' as const,
      isManual: s.isManual,
      retryCount: 0,
    })),
  );

  return runId;
}

export interface OffboardingCandidate {
  id: string;
  employeeCode: string;
  name: string;
  position: string | null;
  department: string | null;
  companyEmail: string | null;
}

export async function getOffboardingCandidates(): Promise<OffboardingCandidate[]> {
  const employees = await db
    .select({
      id: atlasEmployees.id,
      employeeCode: atlasEmployees.employeeCode,
      firstName: atlasEmployees.firstName,
      lastName: atlasEmployees.lastName,
      position: atlasEmployees.position,
      department: atlasEmployees.department,
      companyEmail: atlasEmployees.companyEmail,
    })
    .from(atlasEmployees)
    .where(isNull(atlasEmployees.deletedAt))
    .orderBy(sql`concat(${atlasEmployees.firstName}, ' ', ${atlasEmployees.lastName})`);

  if (employees.length === 0) return [];

  const empIds = employees.map((e) => e.id);

  const activeOffboardingRuns = await db
    .select({ employeeId: atlasWorkflowRuns.employeeId })
    .from(atlasWorkflowRuns)
    .where(
      and(
        inArray(atlasWorkflowRuns.employeeId, empIds),
        eq(atlasWorkflowRuns.type, 'offboarding'),
        sql`${atlasWorkflowRuns.status} in ('pending','in-progress','blocked')`,
      ),
    );

  const alreadyOffboarding = new Set(activeOffboardingRuns.map((r) => r.employeeId));

  return employees
    .filter((e) => !alreadyOffboarding.has(e.id))
    .map((e) => ({
      id: e.id,
      employeeCode: e.employeeCode,
      name: `${e.firstName} ${e.lastName}`,
      position: e.position ?? null,
      department: e.department ?? null,
      companyEmail: e.companyEmail ?? null,
    }));
}

// ─── markStepDone / overrideStep ─────────────────────────────────────────────

export async function markStepDone(stepId: string, runId: string) {
  await db
    .update(atlasWorkflowSteps)
    .set({ status: 'done', completedAt: new Date() })
    .where(and(eq(atlasWorkflowSteps.id, stepId), eq(atlasWorkflowSteps.runId, runId)));
}
