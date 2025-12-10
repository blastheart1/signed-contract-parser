import { pgTable, uuid, varchar, text, timestamp, boolean, decimal, integer, pgEnum, jsonb, unique, index } from 'drizzle-orm/pg-core';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'contract_manager', 'sales_rep', 'accountant', 'viewer', 'vendor']);
export const userStatusEnum = pgEnum('user_status', ['pending', 'active', 'suspended']);
export const orderStatusEnum = pgEnum('order_status', ['pending_updates', 'completed']);
export const itemTypeEnum = pgEnum('item_type', ['maincategory', 'subcategory', 'item']);
export const changeTypeEnum = pgEnum('change_type', ['cell_edit', 'row_add', 'row_delete', 'row_update', 'customer_edit', 'order_edit', 'contract_add', 'stage_update', 'customer_delete', 'customer_restore']);
export const customerStatusEnum = pgEnum('customer_status', ['pending_updates', 'completed']);

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

