import { pgTable, uuid, varchar, text, timestamp, boolean, decimal, integer, pgEnum, jsonb, unique, index, foreignKey } from 'drizzle-orm/pg-core';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'calimingo_admin', 'contract_manager', 'sales_rep', 'accountant', 'viewer', 'vendor']);
export const userStatusEnum = pgEnum('user_status', ['pending', 'active', 'suspended']);
export const orderStatusEnum = pgEnum('order_status', ['pending_updates', 'completed']);
export const itemTypeEnum = pgEnum('item_type', ['maincategory', 'subcategory', 'item']);
export const changeTypeEnum = pgEnum('change_type', ['cell_edit', 'row_add', 'row_delete', 'row_update', 'customer_edit', 'order_edit', 'contract_add', 'stage_update', 'customer_delete', 'customer_restore']);
export const customerStatusEnum = pgEnum('customer_status', ['pending_updates', 'completed']);
export const vendorStatusEnum = pgEnum('vendor_status', ['active', 'inactive']);
export const orderApprovalStageEnum = pgEnum('order_approval_stage', ['draft', 'sent', 'negotiating', 'approved']);

// Users Table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  role: userRoleEnum('role'), // Nullable - admin assigns role upon approval
  status: userStatusEnum('status').notNull().default('pending'),
  salesRepName: varchar('sales_rep_name', { length: 255 }), // For sales_rep role: name matching orders.sales_rep
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastLogin: timestamp('last_login'),
});

// Customers Table - PRIMARY KEY: dbx_customer_id (string)
export const customers = pgTable('customers', {
  dbxCustomerId: varchar('dbx_customer_id', { length: 255 }).primaryKey().notNull(),
  clientName: varchar('client_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  streetAddress: varchar('street_address', { length: 255 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  state: varchar('state', { length: 50 }).notNull(),
  zip: varchar('zip', { length: 20 }).notNull(),
  status: customerStatusEnum('status').default('pending_updates'),
  deletedAt: timestamp('deleted_at'), // Soft delete: when customer was deleted (null = not deleted)
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  deletedAtIdx: index('customers_deleted_at_idx').on(table.deletedAt),
  updatedAtIdx: index('customers_updated_at_idx').on(table.updatedAt),
  statusIdx: index('customers_status_idx').on(table.status),
}));

// Orders Table
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: varchar('customer_id', { length: 255 }).notNull().references(() => customers.dbxCustomerId), // String FK to customers
  orderNo: varchar('order_no', { length: 255 }).notNull().unique(),
  orderDate: timestamp('order_date'),
  orderPO: varchar('order_po', { length: 255 }),
  orderDueDate: timestamp('order_due_date'),
  orderType: varchar('order_type', { length: 100 }),
  orderDelivered: boolean('order_delivered').default(false),
  quoteExpirationDate: timestamp('quote_expiration_date'),
  orderGrandTotal: decimal('order_grand_total', { precision: 15, scale: 2 }).notNull(),
  progressPayments: text('progress_payments'),
  balanceDue: decimal('balance_due', { precision: 15, scale: 2 }).notNull(),
  salesRep: varchar('sales_rep', { length: 255 }),
  status: orderStatusEnum('status').default('pending_updates'),
  stage: varchar('stage', { length: 50 }), // 'waiting_for_permit', 'active', 'completed'
  contractDate: varchar('contract_date', { length: 20 }), // MM/DD/YYYY format as string
  firstBuildInvoiceDate: varchar('first_build_invoice_date', { length: 20 }), // MM/DD/YYYY format as string
  projectStartDate: varchar('project_start_date', { length: 20 }), // MM/DD/YYYY format as string
  projectEndDate: varchar('project_end_date', { length: 20 }), // MM/DD/YYYY format as string
  emlBlobUrl: varchar('eml_blob_url', { length: 500 }), // For future Vercel Blob implementation
  emlFilename: varchar('eml_filename', { length: 255 }), // For future Vercel Blob implementation
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedBy: uuid('updated_by').references(() => users.id),
}, (table) => ({
  customerIdIdx: index('orders_customer_id_idx').on(table.customerId),
  createdAtIdx: index('orders_created_at_idx').on(table.createdAt),
}));

// Order Items Table
export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  rowIndex: integer('row_index').notNull(),
  columnALabel: varchar('column_a_label', { length: 50 }), // '1 - Header', '1 - Subheader', '1 - Detail', '1 - Blank Row'
  columnBLabel: varchar('column_b_label', { length: 50 }), // 'Initial', 'Addendum'
  productService: text('product_service').notNull(), // Columns D-E merged
  qty: decimal('qty', { precision: 15, scale: 2 }),
  rate: decimal('rate', { precision: 15, scale: 2 }),
  amount: decimal('amount', { precision: 15, scale: 2 }),
  progressOverallPct: decimal('progress_overall_pct', { precision: 10, scale: 4 }), // Column I
  completedAmount: decimal('completed_amount', { precision: 15, scale: 2 }), // Column J
  previouslyInvoicedPct: decimal('previously_invoiced_pct', { precision: 10, scale: 4 }), // Column K
  previouslyInvoicedAmount: decimal('previously_invoiced_amount', { precision: 15, scale: 2 }), // Column L
  newProgressPct: decimal('new_progress_pct', { precision: 10, scale: 4 }), // Column M
  thisBill: decimal('this_bill', { precision: 15, scale: 2 }), // Column N
  itemType: itemTypeEnum('item_type').notNull(),
  mainCategory: varchar('main_category', { length: 255 }),
  subCategory: varchar('sub_category', { length: 255 }),
  // Vendor Selection fields (columns Q-W)
  vendorName1: varchar('vendor_name_1', { length: 255 }),
  vendorPercentage: decimal('vendor_percentage', { precision: 10, scale: 4 }),
  totalWorkAssignedToVendor: decimal('total_work_assigned_to_vendor', { precision: 15, scale: 2 }),
  estimatedVendorCost: decimal('estimated_vendor_cost', { precision: 15, scale: 2 }),
  totalAmountWorkCompleted: decimal('total_amount_work_completed', { precision: 15, scale: 2 }),
  vendorBillingToDate: decimal('vendor_billing_to_date', { precision: 15, scale: 2 }),
  vendorSavingsDeficit: decimal('vendor_savings_deficit', { precision: 15, scale: 2 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orderIdIdx: index('order_items_order_id_idx').on(table.orderId),
}));

// Invoices Table
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  invoiceNumber: varchar('invoice_number', { length: 255 }),
  invoiceDate: timestamp('invoice_date'),
  invoiceAmount: decimal('invoice_amount', { precision: 15, scale: 2 }),
  paymentsReceived: decimal('payments_received', { precision: 15, scale: 2 }).default('0'),
  exclude: boolean('exclude').default(false),
  rowIndex: integer('row_index'), // Position in table (354-391)
  linkedLineItems: jsonb('linked_line_items'), // Array of { orderItemId: string, thisBillAmount: number } for audit trail
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orderIdIdx: index('invoices_order_id_idx').on(table.orderId),
  updatedAtIdx: index('invoices_updated_at_idx').on(table.updatedAt),
}));

// Change History Table
export const changeHistory = pgTable('change_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').references(() => orders.id),
  orderItemId: uuid('order_item_id').references(() => orderItems.id),
  customerId: varchar('customer_id', { length: 255 }).references(() => customers.dbxCustomerId), // String FK to customers
  changeType: changeTypeEnum('change_type').notNull(),
  fieldName: varchar('field_name', { length: 255 }).notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  rowIndex: integer('row_index'),
  changedBy: uuid('changed_by').notNull().references(() => users.id),
  changedAt: timestamp('changed_at').notNull().defaultNow(),
}, (table) => ({
  customerIdIdx: index('change_history_customer_id_idx').on(table.customerId),
  orderIdIdx: index('change_history_order_id_idx').on(table.orderId),
  changedAtIdx: index('change_history_changed_at_idx').on(table.changedAt),
}));

// Admin Preferences Table (for notes, todos, maintenance)
export const adminPreferences = pgTable('admin_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  preferenceType: varchar('preference_type', { length: 50 }).notNull(), // 'note', 'todo', 'maintenance'
  title: varchar('title', { length: 255 }),
  content: text('content'),
  metadata: jsonb('metadata'), // For additional fields (dueDate, completed, recurring, etc.)
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Alert Acknowledgments Table
export const alertAcknowledgments = pgTable('alert_acknowledgments', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: varchar('customer_id', { length: 255 }).notNull().references(() => customers.dbxCustomerId),
  alertType: varchar('alert_type', { length: 50 }).notNull(), // 'order_items_mismatch', etc.
  acknowledgedBy: uuid('acknowledged_by').notNull().references(() => users.id),
  acknowledgedAt: timestamp('acknowledged_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  customerAlertUnique: unique().on(table.customerId, table.alertType),
  customerIdIdx: index('alert_acknowledgments_customer_id_idx').on(table.customerId),
}));

// Vendors Table
export const vendors = pgTable('vendors', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  contactPerson: varchar('contact_person', { length: 255 }),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 50 }),
  zip: varchar('zip', { length: 20 }),
  category: varchar('category', { length: 100 }), // e.g., "Plumbing", "Electrical", "Concrete"
  status: vendorStatusEnum('status').default('active'),
  notes: text('notes'),
  specialties: text('specialties').array(), // Array of specialties
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'), // Soft delete: when vendor was deleted (null = not deleted)
}, (table) => ({
  nameIdx: index('vendors_name_idx').on(table.name),
  statusIdx: index('vendors_status_idx').on(table.status),
  categoryIdx: index('vendors_category_idx').on(table.category),
  deletedAtIdx: index('vendors_deleted_at_idx').on(table.deletedAt),
}));

// Order Approvals Table
export const orderApprovals = pgTable('order_approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  referenceNo: varchar('reference_no', { length: 20 }).notNull().unique(), // Format: YYYY-XXXXX
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  customerId: varchar('customer_id', { length: 255 }).notNull().references(() => customers.dbxCustomerId),
  orderId: uuid('order_id').references(() => orders.id), // Nullable - items can come from multiple orders
  stage: orderApprovalStageEnum('stage').notNull().default('draft'),
  pmApproved: boolean('pm_approved').notNull().default(false),
  vendorApproved: boolean('vendor_approved').notNull().default(false),
  vendorApprovedAt: timestamp('vendor_approved_at'), // When vendor last approved (set on approve; no retract logic)
  dateCreated: timestamp('date_created').notNull().defaultNow(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  sentAt: timestamp('sent_at'), // When approval was sent to vendor
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'), // Soft delete
}, (table) => ({
  referenceNoIdx: index('order_approvals_reference_no_idx').on(table.referenceNo),
  vendorIdIdx: index('order_approvals_vendor_id_idx').on(table.vendorId),
  customerIdIdx: index('order_approvals_customer_id_idx').on(table.customerId),
  orderIdIdx: index('order_approvals_order_id_idx').on(table.orderId),
  stageIdx: index('order_approvals_stage_idx').on(table.stage),
  deletedAtIdx: index('order_approvals_deleted_at_idx').on(table.deletedAt),
  createdAtIdx: index('order_approvals_date_created_idx').on(table.dateCreated),
}));

// Order Approval Items Table (links selected items to approvals)
// Note: orderItemId does NOT have a foreign key constraint to allow order items
// to be deleted/updated without blocking. Order approvals are additive and should
// not affect existing order item functionality.
// Snapshot fields store a copy of order item data at approval time for reference.
export const orderApprovalItems = pgTable('order_approval_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderApprovalId: uuid('order_approval_id').notNull().references(() => orderApprovals.id, { onDelete: 'cascade' }),
  orderItemId: uuid('order_item_id').notNull(), // No FK constraint - additive feature shouldn't block order item updates
  createdAt: timestamp('created_at').notNull().defaultNow(),
  // Snapshot fields (nullable to support existing records)
  productService: text('product_service'), // Snapshot of product/service name
  amount: decimal('amount', { precision: 15, scale: 2 }), // Snapshot of original amount
  qty: decimal('qty', { precision: 15, scale: 2 }), // Snapshot of quantity
  rate: decimal('rate', { precision: 15, scale: 2 }), // Snapshot of rate
  negotiatedVendorAmount: decimal('negotiated_vendor_amount', { precision: 15, scale: 2 }), // Approved/negotiated amount (from Part 2)
  snapshotDate: timestamp('snapshot_date'), // When snapshot was taken
}, (table) => ({
  orderApprovalIdIdx: index('order_approval_items_order_approval_id_idx').on(table.orderApprovalId),
  orderItemIdIdx: index('order_approval_items_order_item_id_idx').on(table.orderItemId),
  snapshotDateIdx: index('order_approval_items_snapshot_date_idx').on(table.snapshotDate),
  uniqueApprovalItem: unique().on(table.orderApprovalId, table.orderItemId), // Prevent duplicate selections
}));

// Reference Number Sequence Table (for generating YYYY-XXXXX reference numbers)
export const referenceNumberSequence = pgTable('reference_number_sequence', {
  id: uuid('id').primaryKey().defaultRandom(),
  year: integer('year').notNull().unique(),
  lastSequence: integer('last_sequence').notNull().default(0),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  yearIdx: index('reference_number_sequence_year_idx').on(table.year),
}));

// ─────────────────────────────────────────────────────────────────────────────
// ATLAS — Onboarding & Offboarding Platform
// ─────────────────────────────────────────────────────────────────────────────

export const atlasWorkflowStatusEnum = pgEnum('atlas_workflow_status', [
  'pending', 'in-progress', 'blocked', 'completed', 'failed',
]);

export const atlasWorkflowTypeEnum = pgEnum('atlas_workflow_type', [
  'onboarding', 'offboarding',
]);

export const atlasSystemStatusEnum = pgEnum('atlas_system_status', [
  'provisioned', 'invited', 'pending', 'failed',
  'suspend-pending', 'revoked', 'archived',
]);

export const atlasStepStatusEnum = pgEnum('atlas_step_status', [
  'queued', 'active', 'done', 'blocked', 'skipped', 'failed',
]);

export const atlasRoleEnum = pgEnum('atlas_role', [
  'hr_admin', 'it_admin', 'ops_admin', 'finance', 'manager', 'viewer',
]);

// atlas_employees — core person record
export const atlasEmployees = pgTable('atlas_employees', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeCode: varchar('employee_code', { length: 20 }).notNull().unique(), // e.g. E-2481
  firstName: varchar('first_name', { length: 255 }).notNull(),
  lastName: varchar('last_name', { length: 255 }).notNull(),
  personalEmail: varchar('personal_email', { length: 255 }),
  companyEmail: varchar('company_email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  position: varchar('position', { length: 255 }),
  department: varchar('department', { length: 100 }),
  location: varchar('location', { length: 255 }),
  employmentType: varchar('employment_type', { length: 50 }).default('full-time'),
  managerId: uuid('manager_id'), // self-ref, no FK to avoid migration ordering issues
  managerName: varchar('manager_name', { length: 255 }), // denormalised for display
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  accessPreset: varchar('access_preset', { length: 50 }), // e.g. SVC_TECH_L1
  salaryEncrypted: text('salary_encrypted'), // AES-encrypted; never plain-text
  compVisibility: varchar('comp_visibility', { length: 30 }).default('restricted'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (t) => ({
  codeIdx: index('atlas_employees_code_idx').on(t.employeeCode),
  deptIdx: index('atlas_employees_dept_idx').on(t.department),
}));

// atlas_workflow_runs — one run per onboarding/offboarding event
export const atlasWorkflowRuns = pgTable('atlas_workflow_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  runCode: varchar('run_code', { length: 30 }).notNull().unique(), // e.g. RUN-2026-0481
  employeeId: uuid('employee_id').notNull().references(() => atlasEmployees.id),
  type: atlasWorkflowTypeEnum('type').notNull(),
  status: atlasWorkflowStatusEnum('status').notNull().default('pending'),
  ownerId: uuid('owner_id').references(() => users.id),
  ownerLabel: varchar('owner_label', { length: 100 }), // denormalised display ("HR — Lena Park")
  riskNote: text('risk_note'),
  payload: jsonb('payload'), // full input snapshot at run start
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  employeeIdx: index('atlas_runs_employee_id_idx').on(t.employeeId),
  statusIdx: index('atlas_runs_status_idx').on(t.status),
  typeIdx: index('atlas_runs_type_idx').on(t.type),
}));

// atlas_workflow_steps — individual steps within a run
export const atlasWorkflowSteps = pgTable('atlas_workflow_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => atlasWorkflowRuns.id, { onDelete: 'cascade' }),
  stepKey: varchar('step_key', { length: 100 }).notNull(), // e.g. google.workspace.create_user
  phase: varchar('phase', { length: 50 }), // Pre-boarding | Orientation | Enablement
  title: varchar('title', { length: 255 }).notNull(),
  status: atlasStepStatusEnum('status').notNull().default('queued'),
  isManual: boolean('is_manual').notNull().default(false), // pauses for human review
  retryCount: integer('retry_count').notNull().default(0),
  inputPayload: jsonb('input_payload'),
  resultPayload: jsonb('result_payload'),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  runIdx: index('atlas_steps_run_id_idx').on(t.runId),
  statusIdx: index('atlas_steps_status_idx').on(t.status),
}));

// atlas_access_accounts — per-system provisioning state for an employee
export const atlasAccessAccounts = pgTable('atlas_access_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull().references(() => atlasEmployees.id),
  system: varchar('system', { length: 50 }).notNull(), // gmail | trello | trainual | dropbox | billcom | quickbooks | fleet
  status: atlasSystemStatusEnum('status'),
  externalId: varchar('external_id', { length: 255 }), // provider-side user/member ID
  lastSyncedAt: timestamp('last_synced_at'),
  provisionedAt: timestamp('provisioned_at'),
  revokedAt: timestamp('revoked_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  employeeSystemUnique: unique().on(t.employeeId, t.system),
  employeeIdx: index('atlas_access_employee_id_idx').on(t.employeeId),
}));

// atlas_integration_events — raw event log from provider API calls
export const atlasIntegrationEvents = pgTable('atlas_integration_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').references(() => atlasWorkflowRuns.id),
  stepId: uuid('step_id').references(() => atlasWorkflowSteps.id),
  provider: varchar('provider', { length: 50 }).notNull(), // google | trello | trainual
  eventType: varchar('event_type', { length: 100 }).notNull(), // create_user | invite_member | assign_plan
  status: varchar('status', { length: 20 }).notNull(), // ok | warn | error
  httpStatus: integer('http_status'),
  requestPayload: jsonb('request_payload'),
  responsePayload: jsonb('response_payload'),
  errorMessage: text('error_message'),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  runIdx: index('atlas_int_events_run_id_idx').on(t.runId),
  providerIdx: index('atlas_int_events_provider_idx').on(t.provider),
  createdAtIdx: index('atlas_int_events_created_at_idx').on(t.createdAt),
}));

// atlas_audit_logs — immutable append-only record of every action
export const atlasAuditLogs = pgTable('atlas_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actor: varchar('actor', { length: 255 }).notNull(), // "HR:Lena Park" or "System"
  actorId: uuid('actor_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(), // e.g. intake.submit | email.approve | run.cancel
  entityType: varchar('entity_type', { length: 50 }), // employee | run | step | access_account
  entityId: uuid('entity_id'),
  detail: jsonb('detail'), // arbitrary context blob
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  actorIdIdx: index('atlas_audit_actor_id_idx').on(t.actorId),
  entityIdx: index('atlas_audit_entity_idx').on(t.entityType, t.entityId),
  createdAtIdx: index('atlas_audit_created_at_idx').on(t.createdAt),
}));

// atlas_email_deliveries — tracks every email sent through the Atlas
export const atlasEmailDeliveries = pgTable('atlas_email_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').references(() => atlasWorkflowRuns.id),
  employeeId: uuid('employee_id').references(() => atlasEmployees.id),
  templateKey: varchar('template_key', { length: 100 }).notNull(), // welcome_v3 | access_info_v2
  toAddress: varchar('to_address', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 500 }),
  status: varchar('status', { length: 30 }).notNull().default('draft'), // draft | awaiting_approval | scheduled | sent | failed
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  scheduledAt: timestamp('scheduled_at'),
  sentAt: timestamp('sent_at'),
  providerMessageId: varchar('provider_message_id', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  runIdx: index('atlas_email_run_id_idx').on(t.runId),
  employeeIdx: index('atlas_email_employee_id_idx').on(t.employeeId),
  statusIdx: index('atlas_email_status_idx').on(t.status),
}));

// atlas_role_templates — HR-managed access presets (Access Matrix rows)
export const atlasRoleTemplates = pgTable('atlas_role_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  presetCode: varchar('preset_code', { length: 50 }).notNull().unique(), // SVC_TECH_L1
  label: varchar('label', { length: 255 }).notNull(),
  department: varchar('department', { length: 100 }),
  entitlements: jsonb('entitlements').notNull(), // { gmail: true, trello: true, ... }
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  codeIdx: index('atlas_role_templates_code_idx').on(t.presetCode),
}));

// atlas_notes — internal notes on an employee record
export const atlasNotes = pgTable('atlas_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull().references(() => atlasEmployees.id),
  runId: uuid('run_id').references(() => atlasWorkflowRuns.id),
  authorId: uuid('author_id').references(() => users.id),
  authorLabel: varchar('author_label', { length: 100 }),
  body: text('body').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  employeeIdx: index('atlas_notes_employee_id_idx').on(t.employeeId),
}));

// atlas_equipment — physical devices and hardware assigned to employees
export const atlasEquipment = pgTable('atlas_equipment', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull().references(() => atlasEmployees.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(), // laptop | mobile | monitor | tablet | headset | keyboard | mouse | other
  brand: varchar('brand', { length: 100 }),
  model: varchar('model', { length: 200 }),
  serialNumber: varchar('serial_number', { length: 100 }),
  assetTag: varchar('asset_tag', { length: 50 }),
  condition: varchar('condition', { length: 20 }).notNull().default('good'), // new | good | fair | damaged | returned
  notes: text('notes'),
  assignedAt: timestamp('assigned_at').notNull().defaultNow(),
  returnedAt: timestamp('returned_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  employeeIdx: index('atlas_equipment_employee_id_idx').on(t.employeeId),
}));

// atlas_cards — company credit cards (including supplementary)
export const atlasCards = pgTable('atlas_cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull().references(() => atlasEmployees.id, { onDelete: 'cascade' }),
  cardholderName: varchar('cardholder_name', { length: 200 }).notNull(),
  last4: varchar('last4', { length: 4 }),
  issuer: varchar('issuer', { length: 50 }).notNull().default('Visa'), // Visa | Mastercard | Amex
  creditLimit: integer('credit_limit'), // in cents
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  supplementaryTo: uuid('supplementary_to'),
  primaryOwnerName: varchar('primary_owner_name', { length: 200 }), // denormalised — who holds the primary line
  status: varchar('status', { length: 20 }).notNull().default('active'), // active | suspended | cancelled
  assignedAt: timestamp('assigned_at').notNull().defaultNow(),
  cancelledAt: timestamp('cancelled_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  employeeIdx: index('atlas_cards_employee_id_idx').on(t.employeeId),
  supplementaryFk: foreignKey({ columns: [t.supplementaryTo], foreignColumns: [t.id] }),
}));

// Atlas type exports
export type AtlasEmployee = typeof atlasEmployees.$inferSelect;
export type NewAtlasEmployee = typeof atlasEmployees.$inferInsert;
export type AtlasWorkflowRun = typeof atlasWorkflowRuns.$inferSelect;
export type NewAtlasWorkflowRun = typeof atlasWorkflowRuns.$inferInsert;
export type AtlasWorkflowStep = typeof atlasWorkflowSteps.$inferSelect;
export type NewAtlasWorkflowStep = typeof atlasWorkflowSteps.$inferInsert;
export type AtlasAccessAccount = typeof atlasAccessAccounts.$inferSelect;
export type NewAtlasAccessAccount = typeof atlasAccessAccounts.$inferInsert;
export type AtlasIntegrationEvent = typeof atlasIntegrationEvents.$inferSelect;
export type NewAtlasIntegrationEvent = typeof atlasIntegrationEvents.$inferInsert;
export type AtlasAuditLog = typeof atlasAuditLogs.$inferSelect;
export type NewAtlasAuditLog = typeof atlasAuditLogs.$inferInsert;
export type AtlasEmailDelivery = typeof atlasEmailDeliveries.$inferSelect;
export type NewAtlasEmailDelivery = typeof atlasEmailDeliveries.$inferInsert;
export type AtlasRoleTemplate = typeof atlasRoleTemplates.$inferSelect;
export type NewAtlasRoleTemplate = typeof atlasRoleTemplates.$inferInsert;
export type AtlasNote = typeof atlasNotes.$inferSelect;
export type NewAtlasNote = typeof atlasNotes.$inferInsert;
export type AtlasEquipment = typeof atlasEquipment.$inferSelect;
export type NewAtlasEquipment = typeof atlasEquipment.$inferInsert;
export type AtlasCard = typeof atlasCards.$inferSelect;
export type NewAtlasCard = typeof atlasCards.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────

// Type exports for use in application
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type ChangeHistory = typeof changeHistory.$inferSelect;
export type NewChangeHistory = typeof changeHistory.$inferInsert;
export type AdminPreference = typeof adminPreferences.$inferSelect;
export type NewAdminPreference = typeof adminPreferences.$inferInsert;
export type AlertAcknowledgment = typeof alertAcknowledgments.$inferSelect;
export type NewAlertAcknowledgment = typeof alertAcknowledgments.$inferInsert;
export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;
export type OrderApproval = typeof orderApprovals.$inferSelect;
export type NewOrderApproval = typeof orderApprovals.$inferInsert;
export type OrderApprovalItem = typeof orderApprovalItems.$inferSelect;
export type NewOrderApprovalItem = typeof orderApprovalItems.$inferInsert;
export type ReferenceNumberSequence = typeof referenceNumberSequence.$inferSelect;
export type NewReferenceNumberSequence = typeof referenceNumberSequence.$inferInsert;

