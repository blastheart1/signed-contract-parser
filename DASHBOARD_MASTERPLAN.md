# Dashboard with Admin Panel and Database - Master Plan

## Overview
Transform the contract parser into a full dashboard application with user authentication, database storage, admin panel, and editable contract management with change tracking.

## Database Schema

### Users Table
- `id` (UUID, primary key)
- `username` (string, unique)
- `password_hash` (string, bcrypt)
- `email` (string, optional)
- `role` (enum: 'admin', 'editor', 'viewer', 'vendor')
- `status` (enum: 'pending', 'active', 'suspended')
- `created_at` (timestamp)
- `updated_at` (timestamp)
- `last_login` (timestamp, nullable)

### Customers Table
- `id` (UUID, primary key)
- `dbx_customer_id` (string, unique, nullable)
- `client_name` (string)
- `email` (string, nullable)
- `phone` (string, nullable)
- `street_address` (string)
- `city` (string)
- `state` (string)
- `zip` (string)
- `full_address` (string, computed)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### Orders Table
- `id` (UUID, primary key)
- `customer_id` (UUID, foreign key to customers)
- `order_no` (string, unique)
- `order_date` (date, nullable)
- `order_po` (string, nullable)
- `order_due_date` (date, nullable)
- `order_type` (string, nullable)
- `order_delivered` (boolean, default false)
- `quote_expiration_date` (date, nullable)
- `order_grand_total` (decimal)
- `progress_payments` (text, nullable) - JSON or text
- `balance_due` (decimal)
- `sales_rep` (string, nullable)
- `status` (enum: 'pending_updates', 'completed') - from Column E Row 4 dropdown
- `created_at` (timestamp)
- `updated_at` (timestamp)
- `created_by` (UUID, foreign key to users)
- `updated_by` (UUID, foreign key to users)

### Order Items Table
- `id` (UUID, primary key)
- `order_id` (UUID, foreign key to orders)
- `row_index` (integer) - position in table
- `column_a_label` (string) - '1 - Header', '1 - Subheader', '1 - Detail', '1 - Blank Row'
- `column_b_label` (string) - 'Initial', 'Addendum'
- `product_service` (text) - Columns D-E merged
- `qty` (decimal, nullable) - Column F
- `rate` (decimal, nullable) - Column G
- `amount` (decimal, nullable) - Column H
- `progress_overall_pct` (decimal, nullable) - Column I
- `completed_amount` (decimal, nullable) - Column J
- `previously_invoiced_pct` (decimal, nullable) - Column K
- `previously_invoiced_amount` (decimal, nullable) - Column L
- `new_progress_pct` (decimal, nullable) - Column M
- `this_bill` (decimal, nullable) - Column N
- `item_type` (enum: 'maincategory', 'subcategory', 'item')
- `main_category` (string, nullable)
- `sub_category` (string, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### Change History Table
- `id` (UUID, primary key)
- `order_id` (UUID, foreign key to orders, nullable)
- `order_item_id` (UUID, foreign key to order_items, nullable)
- `customer_id` (UUID, foreign key to customers, nullable)
- `change_type` (enum: 'cell_edit', 'row_add', 'row_delete', 'row_update', 'customer_edit', 'order_edit')
- `field_name` (string) - column name or field name
- `old_value` (text, nullable)
- `new_value` (text, nullable)
- `row_index` (integer, nullable) - for row-level tracking
- `changed_by` (UUID, foreign key to users)
- `changed_at` (timestamp)

## Implementation Steps

### Phase 1: Database Setup
1. **Install database dependencies**
   - Add `pg` (PostgreSQL) and `@types/pg` for production
   - Add `better-sqlite3` and `@types/better-sqlite3` for testing/development
   - Add `bcryptjs` and `@types/bcryptjs` for password hashing
   - Add database migration tool (e.g., `drizzle-orm` or `kysely`)

2. **Create database configuration**
   - Create `lib/db/config.ts` with connection logic
   - Support both PostgreSQL (production) and SQLite (testing)
   - Environment variable: `DATABASE_URL` for PostgreSQL, `DATABASE_PATH` for SQLite

3. **Create database schema files**
   - Create migration files for all tables
   - Set up foreign key relationships
   - Add indexes for performance (order_no, customer_id, etc.)

### Phase 2: Enhanced Data Extraction
1. **Extend Location interface**
   - Update `lib/tableExtractor.ts` `Location` interface to include:
     - `email`, `phone`, `orderDate`, `orderPO`, `orderDueDate`, `orderType`, 
     - `orderDelivered`, `quoteExpirationDate`, `orderGrandTotal`, 
     - `progressPayments`, `balanceDue`, `salesRep`

2. **Update extractLocation function**
   - Add regex patterns to extract all Job Info fields from email text
   - Parse dates and numbers correctly
   - Handle missing/empty values gracefully

3. **Update OrderItem interface**
   - Add fields for columns I-N: `progressOverallPct`, `completedAmount`, 
     `previouslyInvoicedPct`, `previouslyInvoicedAmount`, `newProgressPct`, `thisBill`

### Phase 3: Authentication System
1. **Create authentication API routes**
   - `app/api/auth/register/route.ts` - User registration (creates pending user)
   - `app/api/auth/login/route.ts` - Username/password login
   - `app/api/auth/logout/route.ts` - Logout
   - `app/api/auth/session/route.ts` - Get current session

2. **Create authentication middleware**
   - `lib/auth/middleware.ts` - Protect API routes
   - `lib/auth/session.ts` - Session management (JWT or session cookies)

3. **Create login/register pages**
   - `app/login/page.tsx` - Login form
   - `app/register/page.tsx` - Registration form (creates pending status)

### Phase 4: Admin Panel
1. **Create admin API routes**
   - `app/api/admin/users/route.ts` - List users, approve/deny, assign roles
   - `app/api/admin/users/[id]/route.ts` - Update user, reset password
   - `app/api/admin/users/[id]/reset-password/route.ts` - Reset password endpoint

2. **Create admin pages**
   - `app/admin/page.tsx` - Admin dashboard overview
   - `app/admin/users/page.tsx` - User management (list, approve, assign roles)
   - `app/admin/users/[id]/page.tsx` - Edit user details

3. **Create admin components**
   - `components/admin/UserList.tsx` - Table of users with actions
   - `components/admin/UserApproval.tsx` - Approve/deny pending users
   - `components/admin/RoleSelector.tsx` - Role assignment dropdown

### Phase 5: Contract Storage API
1. **Create contract API routes**
   - `app/api/contracts/upload/route.ts` - Upload and parse EML, save to database
   - `app/api/contracts/route.ts` - List all contracts (with filters)
   - `app/api/contracts/[id]/route.ts` - Get/update contract
   - `app/api/contracts/[id]/items/route.ts` - Get/update order items
   - `app/api/contracts/[id]/items/[itemId]/route.ts` - Update single item

2. **Update parse-contract route**
   - Modify `app/api/parse-contract/route.ts` to optionally save to database
   - Add flag to return data instead of Excel file when saving to DB

### Phase 6: Dashboard UI
1. **Create dashboard layout**
   - `app/dashboard/layout.tsx` - Dashboard layout with navigation
   - `app/dashboard/page.tsx` - Dashboard home (customer list)

2. **Create customer list page**
   - `app/dashboard/customers/page.tsx` - List all customers
   - `components/dashboard/CustomerList.tsx` - Customer table with search/filter

3. **Create customer detail page**
   - `app/dashboard/customers/[id]/page.tsx` - Customer detail view
   - `components/dashboard/CustomerInfo.tsx` - Editable customer info form
   - `components/dashboard/OrderTable.tsx` - Editable order items table

4. **Create order table component**
   - `components/dashboard/EditableOrderTable.tsx` - Full table with:
     - Fixed columns D-N (11 columns)
     - Flexible rows (add/remove)
     - Inline editing
     - Save changes with change tracking
     - Status dropdown (Column E Row 4: pending_updates/completed)

### Phase 7: Change Tracking
1. **Create change tracking service**
   - `lib/services/changeTracker.ts` - Functions to log changes
   - Track cell edits, row additions/deletions, customer edits, order edits

2. **Create change history API**
   - `app/api/contracts/[id]/history/route.ts` - Get change history for order
   - `app/api/customers/[id]/history/route.ts` - Get change history for customer

3. **Create change history UI**
   - `components/dashboard/ChangeHistory.tsx` - Display change history table
   - Show: who, what, when, old value, new value

### Phase 8: Role-Based Access Control
1. **Create permission system**
   - `lib/auth/permissions.ts` - Define permissions per role
   - Admin: full access
   - Editor: create/edit contracts, view all
   - Viewer: view only
   - Vendor: view assigned contracts only

2. **Add permission checks**
   - Middleware to check permissions on API routes
   - UI components to hide/show based on role

### Phase 9: Integration & Testing
1. **Update existing FileUpload component**
   - Add option to save to database instead of just downloading Excel
   - Show success message with link to dashboard

2. **Add navigation**
   - Update main layout with login/logout
   - Add dashboard navigation menu

3. **Testing**
   - Test with SQLite for development
   - Test all CRUD operations
   - Test change tracking
   - Test role-based access

## Key Files to Create/Modify

### New Files
- `lib/db/config.ts` - Database configuration
- `lib/db/schema.ts` - Database schema definitions
- `lib/db/migrations/` - Migration files
- `lib/auth/middleware.ts` - Auth middleware
- `lib/auth/session.ts` - Session management
- `lib/auth/permissions.ts` - Permission system
- `lib/services/changeTracker.ts` - Change tracking service
- `app/api/auth/*/route.ts` - Auth API routes
- `app/api/admin/*/route.ts` - Admin API routes
- `app/api/contracts/*/route.ts` - Contract API routes
- `app/login/page.tsx` - Login page
- `app/register/page.tsx` - Register page
- `app/admin/*/page.tsx` - Admin pages
- `app/dashboard/*/page.tsx` - Dashboard pages
- `components/admin/*.tsx` - Admin components
- `components/dashboard/*.tsx` - Dashboard components

### Modified Files
- `lib/tableExtractor.ts` - Extend Location interface and extraction
- `lib/spreadsheetGenerator.ts` - Support columns I-N
- `app/api/parse-contract/route.ts` - Add database save option
- `components/FileUpload.tsx` - Add save to database option
- `package.json` - Add new dependencies

## Database Choice
- **Development/Testing**: SQLite (better-sqlite3) - simple, file-based, no setup needed
- **Production**: PostgreSQL - robust, scalable, supports concurrent connections

## Notes
- Start with SQLite for rapid development and testing
- Use environment variables to switch between SQLite and PostgreSQL
- All passwords must be hashed with bcrypt
- Change history should be immutable (append-only)
- Order items table should maintain row order (row_index)
- Column E Row 4 status dropdown maps to `orders.status` field

## Template Column Structure (Row 15)
- Column D-E: PRODUCT/SERVICE (merged)
- Column F: QTY
- Column G: RATE
- Column H: AMOUNT
- Column I: % Progress Overall
- Column J: $ Completed
- Column K: % PREVIOUSLY INVOICED
- Column L: $ PREVIOUSLY INVOICED
- Column M: % NEW PROGRESS
- Column N: THIS BILL

## User Roles
- **Admin**: Full access, can manage users, approve registrations, reset passwords
- **Editor**: Can create/edit contracts, view all data
- **Viewer**: View-only access
- **Vendor**: View assigned contracts only

## Change Tracking Requirements
- Track both cell-level and row-level changes
- Record: who changed, what changed, when changed, old value, new value
- Immutable history (append-only)
- Display in change history UI

