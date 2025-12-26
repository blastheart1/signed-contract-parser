# System Architecture Documentation

## Table of Contents
- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Database Architecture](#database-architecture)
- [API Architecture](#api-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Authentication & Authorization](#authentication--authorization)
- [Data Flow](#data-flow)
- [Deployment Architecture](#deployment-architecture)

## Overview

Calimingo Pools Contract Management System is a full-stack web application built with Next.js 14, providing contract parsing, customer management, order tracking, invoice management, and comprehensive admin capabilities.

## System Architecture

### High-Level Architecture

```
┌───────────────────────────────────────────────────────────┐
│                        Client Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Browser    │  │   Mobile     │  │   Tablet     │     │
│  │   (Desktop)  │  │   (iOS/And)  │  │   (iPad)     │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
└─────────┼─────────────────┼─────────────────┼─────────────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────┐
│                    Vercel Edge Network                    │
│              (CDN, Load Balancing, SSL)                   │
└───────────────────────────┬───────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────┐
│                  Next.js Application Layer               │
│  ┌──────────────────────────────────────────────────┐    │
│  │              App Router (Next.js 14)             │    │
│  │  ┌──────────────┐  ┌──────────────┐              │    │
│  │  │   Pages      │  │  API Routes  │              │    │
│  │  │  (React)     │  │ (Serverless) │              │    │
│  │  └──────┬───────┘  └──────┬───────┘              │    │
│  └─────────┼──────────────────┼─────────────────────┘    │
│            │                  │                          │
│  ┌─────────▼──────────────────▼─────── ─┐                │
│  │      Business Logic Layer            │                │
│  │  ┌──────────┐  ┌───────── ─┐         │                │
│  │  │ Services │  │  Parsers  │         │                │
│  │  └────┬─────┘  └─────┬─────┘         │                │
│  └───────┼──────────────┼───────────────┘                │
└──────────┼──────────────┼────────────────────────────────┘
           │              │
           │      ┌───────▼────────┐
           │      │  Drizzle ORM  │
           │      └───────┬────────┘
           │              │
┌──────────▼──────────────▼────────────────────────────────┐
│              Vercel Postgres (Neon)                      │
│  ┌─────────────────────────────────────────────────── ┐  │
│  │              PostgreSQL Database                   │  │
│  │  ┌────────┐ ┌───────-─┐ ┌────────┐ ┌────────┐      │  │
│  │  │ Users  │ │Customers│ │ Orders │ │  ...   │      │  │
│  │  └────────┘ └─────-───┘ └────────┘ └────────┘      │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend

- **Next.js 14** (App Router)
  - Server Components for better performance
  - Client Components for interactivity
  - File-based routing
  - Built-in API routes

- **React 18**
  - Hooks for state management
  - Context API for global state (limited use)
  - Component composition

- **TypeScript**
  - Type safety across the application
  - Better IDE support
  - Compile-time error checking

- **Tailwind CSS**
  - Utility-first CSS framework
  - Responsive design
  - Dark mode support

- **shadcn/ui**
  - Accessible component library
  - Customizable design system
  - Built on Radix UI

- **Framer Motion**
  - Smooth animations
  - Page transitions
  - Component animations

- **@dnd-kit**
  - Drag and drop functionality
  - Accessible drag and drop
  - Sortable lists

### Backend

- **Next.js API Routes**
  - Serverless functions
  - Automatic scaling
  - Edge network distribution

- **Drizzle ORM**
  - Type-safe database queries
  - SQL-like syntax
  - Migration management

- **PostgreSQL** (Vercel Postgres/Neon)
  - Relational database
  - ACID compliance
  - JSON support (for metadata)

### Libraries

- **ExcelJS**: Excel file generation
- **mailparser**: EML file parsing
- **cheerio**: HTML parsing and manipulation
- **bcryptjs**: Password hashing

## Database Architecture

### Schema Design

**Core Tables**:
1. `users` - User accounts and authentication
2. `customers` - Customer information (PK: dbx_customer_id)
3. `orders` - Order/contract information
4. `order_items` - Line items within orders
5. `invoices` - Invoice records
6. `change_history` - Audit trail
7. `admin_preferences` - Admin notes, todos, maintenance

### Relationships

```
users (1) ──< (many) orders
users (1) ──< (many) change_history
customers (1) ──< (many) orders
customers (1) ──< (many) change_history
orders (1) ──< (many) order_items
orders (1) ──< (many) invoices
orders (1) ──< (many) change_history
users (1) ──< (many) admin_preferences
```

### Key Design Decisions

1. **String Primary Key for Customers**: Uses `dbx_customer_id` (string) instead of UUID to match external system
2. **Soft Delete**: Customers use `deleted_at` timestamp instead of hard delete
3. **JSONB for Metadata**: Admin preferences use JSONB for flexible schema
4. **Audit Trail**: Comprehensive change history for all modifications

## API Architecture

### RESTful Design

**Resource-Based URLs**:
- `/api/customers` - Customer resource
- `/api/orders/[id]` - Order resource
- `/api/admin/users` - Admin user management

**HTTP Methods**:
- `GET` - Retrieve resources
- `POST` - Create resources
- `PUT` - Update entire resource
- `PATCH` - Partial update
- `DELETE` - Delete resource

### Authentication Flow

```
1. User submits credentials → POST /api/auth/login
2. Server validates → Creates session cookie
3. Client stores cookie → Automatic on subsequent requests
4. Protected routes check → GET /api/auth/session
5. Middleware validates → Allows/denies access
```

### Authorization Pattern

```typescript
// Check session
const user = await getSession();
if (!user) return 401;

// Check role/permission
if (!isAdmin(user)) return 403;

// Proceed with operation
```

## Frontend Architecture

### Component Hierarchy

```
App Layout
├── Root Layout (providers, global styles)
├── Dashboard Layout (sidebar navigation)
│   ├── Dashboard Page
│   ├── Customers Page
│   └── Customer Detail Page
│       ├── Customer Info Component
│       ├── Order Table Component
│       └── Invoice Table Component
└── Admin Layout (sidebar navigation)
    ├── Admin Overview Page
    ├── Users Page
    ├── Audit Logs Page
    └── Settings Page
```

### State Management

**Server State**:
- Fetched via API routes
- Refreshed on demand
- No global state management library

**Client State**:
- React `useState` for component state
- React `useEffect` for side effects
- Local state for UI interactions

**Form State**:
- Controlled components
- Inline validation
- Optimistic updates where appropriate

### Routing

**File-Based Routing**:
- `app/page.tsx` → `/`
- `app/dashboard/page.tsx` → `/dashboard`
- `app/dashboard/customers/[id]/page.tsx` → `/dashboard/customers/:id`

**Layouts**:
- `app/layout.tsx` - Root layout
- `app/dashboard/layout.tsx` - Dashboard layout with sidebar
- `app/admin/layout.tsx` - Admin layout with sidebar

## Authentication & Authorization

### Authentication

**Method**: Cookie-based sessions
- Secure HTTP-only cookies
- Automatic expiration
- Session validation on each request

**Flow**:
1. User logs in → Credentials validated
2. Session created → Cookie set
3. Subsequent requests → Cookie validated
4. Session expires → User logged out

### Authorization

**Role-Based Access Control (RBAC)**:
- 6 user roles with different permissions
- Role checked at API level
- UI adapts based on role

**Permission System**:
```typescript
// lib/auth/permissions.ts
- isAdmin(user)
- isContractManager(user)
- isSalesRep(user)
- hasPermission(user, action)
```

## Data Flow

### Contract Upload Flow

```
1. User uploads EML file
   ↓
2. Client sends to /api/parse-contract
   ↓
3. Server parses EML (mailparser)
   ↓
4. Extract order items (cheerio)
   ↓
5. Extract customer info (regex)
   ↓
6. Generate Excel (ExcelJS)
   ↓
7. Return to client
   ↓
8. Client displays preview
   ↓
9. User saves → POST /api/contracts
   ↓
10. Server stores in database
```

### Order Item Edit Flow

```
1. User edits cell in Order Table
   ↓
2. Client updates local state
   ↓
3. Auto-save triggers → PUT /api/orders/[id]/items
   ↓
4. Server validates and updates database
   ↓
5. Change logged to change_history
   ↓
6. Response confirms update
   ↓
7. Client shows success feedback
```

## Deployment Architecture

### Vercel Platform

**Infrastructure**:
- Edge Network: Global CDN
- Serverless Functions: Auto-scaling
- Database: Vercel Postgres (Neon)

**Deployment Flow**:
```
1. Code pushed to Git
   ↓
2. Vercel detects changes
   ↓
3. Build process starts
   ↓
4. Next.js builds application
   ↓
5. Deploys to edge network
   ↓
6. Database migrations run (if needed)
   ↓
7. Application live
```

### Environment Configuration

**Development**:
- Local database connection
- Development mode optimizations
- Hot reload enabled

**Production**:
- Production database
- Optimized builds
- Error tracking enabled
- Analytics enabled

## Security Architecture

### Security Layers

1. **Authentication**: Session-based auth with secure cookies
2. **Authorization**: Role-based access control
3. **Input Validation**: Server-side validation for all inputs
4. **SQL Injection Prevention**: Parameterized queries via Drizzle ORM
5. **XSS Prevention**: React's built-in escaping
6. **CSRF Protection**: SameSite cookie attributes

### Data Protection

- **Passwords**: Hashed with bcryptjs
- **Sessions**: Secure HTTP-only cookies
- **Database**: Encrypted connections (SSL/TLS)
- **API**: HTTPS only in production

## Performance Architecture

### Optimization Strategies

1. **Server Components**: Reduce client bundle size
2. **Code Splitting**: Automatic with Next.js
3. **Image Optimization**: Next.js Image component
4. **API Optimization**: Efficient database queries
5. **Caching**: Future implementation planned

### Monitoring

- Vercel Analytics (if enabled)
- Database query monitoring
- Error tracking (future: Sentry)
- Performance monitoring (future: APM)

