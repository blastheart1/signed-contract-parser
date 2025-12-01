# Maintainability Documentation

## Table of Contents
- [Code Organization](#code-organization)
- [File Structure](#file-structure)
- [Naming Conventions](#naming-conventions)
- [Code Patterns](#code-patterns)
- [Database Patterns](#database-patterns)
- [API Design Patterns](#api-design-patterns)
- [Error Handling](#error-handling)
- [Logging](#logging)
- [Testing Strategy](#testing-strategy)
- [Code Review Guidelines](#code-review-guidelines)

## Code Organization

### Directory Structure

```
CalimingoPools/
├── app/                    # Next.js App Router pages and API routes
│   ├── admin/              # Admin panel pages
│   ├── api/                # API route handlers
│   ├── dashboard/          # Dashboard pages
│   └── [auth pages]        # Login, register pages
├── components/             # React components
│   ├── dashboard/          # Dashboard-specific components
│   └── ui/                 # Reusable UI components (shadcn/ui)
├── lib/                    # Core business logic and utilities
│   ├── auth/               # Authentication logic
│   ├── db/                 # Database schema and helpers
│   ├── services/           # Business logic services
│   ├── store/              # Client-side storage (legacy)
│   └── types/               # TypeScript type definitions
├── hooks/                  # React custom hooks
├── public/                 # Static assets
├── contract-parser/        # Templates and sample contracts
└── scripts/                # Utility scripts
```

### Component Organization

**Page Components** (`app/`):
- Use Next.js App Router conventions
- Server components by default, use `'use client'` only when needed
- Keep pages focused on layout and data fetching
- Delegate complex logic to components in `components/`

**Reusable Components** (`components/`):
- Group by feature/domain (e.g., `dashboard/`, `ui/`)
- Keep components small and focused (single responsibility)
- Extract shared logic into custom hooks
- Use TypeScript interfaces for props

**Business Logic** (`lib/`):
- Keep business logic separate from UI components
- Use service pattern for complex operations
- Database helpers in `lib/db/`
- Type definitions in `lib/types/`

## File Structure

### Naming Conventions

- **Files**: kebab-case for all files (e.g., `customer-info.tsx`, `invoice-table.tsx`)
- **Components**: PascalCase for component names (e.g., `CustomerInfo`, `InvoiceTable`)
- **Functions**: camelCase (e.g., `fetchCustomers`, `calculateTotal`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`, `API_TIMEOUT`)
- **Types/Interfaces**: PascalCase (e.g., `Customer`, `OrderItem`)

### File Organization Patterns

**API Routes** (`app/api/`):
```
api/
├── [resource]/
│   ├── route.ts           # GET, POST (list/create)
│   └── [id]/
│       ├── route.ts       # GET, PUT, DELETE (single resource)
│       └── [action]/      # Nested actions
│           └── route.ts
```

**Page Components** (`app/`):
```
app/
├── [feature]/
│   ├── page.tsx           # Main page component
│   ├── layout.tsx         # Layout wrapper (optional)
│   └── [dynamic]/
│       └── page.tsx       # Dynamic route page
```

**Components** (`components/`):
```
components/
├── [feature]/             # Feature-specific components
│   ├── ComponentName.tsx
│   └── RelatedComponent.tsx
└── ui/                    # Generic UI components
    └── component-name.tsx
```

## Code Patterns

### React Patterns

**Component Structure**:
```typescript
'use client'; // Only if needed

import { useState, useEffect } from 'react';
import { ComponentProps } from './types';

interface Props {
  // Define props
}

export default function ComponentName({ prop1, prop2 }: Props) {
  // 1. State declarations
  // 2. Hooks (useEffect, custom hooks)
  // 3. Event handlers
  // 4. Render logic
  return (
    // JSX
  );
}
```

**Custom Hooks Pattern**:
```typescript
// hooks/use-feature.ts
export function useFeature() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Fetch logic
  }, []);
  
  return { data, loading };
}
```

### API Route Patterns

**Standard CRUD Pattern**:
```typescript
// app/api/resource/route.ts
export async function GET(request: NextRequest) {
  // 1. Authentication check
  // 2. Authorization check
  // 3. Parse query parameters
  // 4. Database query
  // 5. Return response
}

export async function POST(request: NextRequest) {
  // 1. Authentication check
  // 2. Authorization check
  // 3. Validate request body
  // 4. Database insert
  // 5. Return response
}
```

**Error Handling Pattern**:
```typescript
try {
  // Operation
  return NextResponse.json({ success: true, data });
} catch (error) {
  console.error('Error description:', error);
  return NextResponse.json(
    { 
      error: 'User-friendly message',
      message: error instanceof Error ? error.message : 'Unknown error'
    },
    { status: 500 }
  );
}
```

## Database Patterns

### Schema Design

**Table Naming**:
- Use plural nouns: `users`, `customers`, `orders`
- Use snake_case: `order_items`, `change_history`

**Column Naming**:
- Use camelCase in TypeScript, snake_case in database
- Drizzle ORM handles the mapping automatically

**Relationships**:
- Use foreign keys with proper constraints
- Use `references()` for type safety
- Consider cascade delete behavior

### Query Patterns

**Using Drizzle ORM**:
```typescript
// Simple query
const users = await db.select().from(schema.users);

// With conditions
const activeUsers = await db
  .select()
  .from(schema.users)
  .where(eq(schema.users.status, 'active'));

// With joins
const ordersWithCustomers = await db
  .select()
  .from(schema.orders)
  .leftJoin(schema.customers, eq(schema.orders.customerId, schema.customers.dbxCustomerId));
```

**Transaction Pattern**:
```typescript
await db.transaction(async (tx) => {
  // Multiple operations
  await tx.insert(schema.orders).values(orderData);
  await tx.insert(schema.orderItems).values(itemsData);
});
```

## API Design Patterns

### Request/Response Format

**Success Response**:
```typescript
{
  success: true,
  data: { /* resource data */ },
  // Optional metadata
  total?: number,
  page?: number,
  hasMore?: boolean
}
```

**Error Response**:
```typescript
{
  success: false,
  error: 'User-friendly error message',
  message?: 'Technical error details (dev only)'
}
```

### Authentication Pattern

All protected routes should:
1. Check session: `const user = await getSession();`
2. Verify user exists: `if (!user) return 401`
3. Check permissions: `if (!hasPermission(user, action)) return 403`

### Pagination Pattern

```typescript
const page = parseInt(searchParams.get('page') || '1');
const limit = parseInt(searchParams.get('limit') || '10');
const offset = (page - 1) * limit;

const items = await db
  .select()
  .from(schema.table)
  .limit(limit)
  .offset(offset);

const total = await db.select({ count: count() }).from(schema.table);
```

## Error Handling

### Error Types

1. **Validation Errors** (400): Invalid input data
2. **Authentication Errors** (401): Not logged in
3. **Authorization Errors** (403): Insufficient permissions
4. **Not Found Errors** (404): Resource doesn't exist
5. **Server Errors** (500): Unexpected errors

### Error Handling Strategy

**Client-Side**:
```typescript
try {
  const response = await fetch('/api/endpoint');
  const data = await response.json();
  
  if (!data.success) {
    // Handle error
    console.error(data.error);
    alert(data.error);
    return;
  }
  
  // Use data
} catch (error) {
  console.error('Network error:', error);
  alert('Network error. Please try again.');
}
```

**Server-Side**:
```typescript
try {
  // Operation
} catch (error) {
  console.error('[Context] Error description:', error);
  return NextResponse.json(
    { error: 'User message', message: error.message },
    { status: 500 }
  );
}
```

## Logging

### Logging Strategy

**Console Logging**:
- Use descriptive prefixes: `[API]`, `[changeHistory]`, `[CustomerDetailPage]`
- Log errors with context
- Use appropriate log levels (console.error, console.warn, console.log)

**Log Format**:
```typescript
console.error('[API] Error fetching users:', error);
console.log('[changeHistory] Logging change:', { type, field, oldValue, newValue });
```

### What to Log

- **Errors**: Always log with context
- **Important operations**: User actions, data changes
- **Performance**: Slow queries, large operations
- **Debug info**: Development-only detailed logs

## Testing Strategy

### Testing Levels

1. **Unit Tests**: Test individual functions/components
2. **Integration Tests**: Test API endpoints
3. **E2E Tests**: Test user workflows (future)

### Test File Organization

```
tests/
├── unit/
│   ├── lib/
│   └── components/
├── integration/
│   └── api/
└── e2e/
```

### Testing Patterns

**API Testing**:
```typescript
// Test authentication
// Test authorization
// Test validation
// Test success cases
// Test error cases
```

## Code Review Guidelines

### Checklist

- [ ] Code follows naming conventions
- [ ] TypeScript types are properly defined
- [ ] Error handling is implemented
- [ ] Authentication/authorization checks are present
- [ ] Database queries are efficient
- [ ] No console.logs in production code (use proper logging)
- [ ] Mobile responsiveness is considered
- [ ] Accessibility is considered
- [ ] No hardcoded values (use constants/config)
- [ ] Comments explain "why", not "what"

### Common Issues to Watch For

1. **Missing error handling**
2. **Missing authentication checks**
3. **Inefficient database queries** (N+1 problems)
4. **Hardcoded values** instead of constants
5. **Missing TypeScript types**
6. **Unused imports/variables**
7. **Inconsistent styling/formatting**

## Maintenance Procedures

### Regular Maintenance Tasks

1. **Database Maintenance**:
   - Run trash cleanup periodically
   - Monitor database size
   - Check for orphaned records

2. **Code Maintenance**:
   - Update dependencies regularly
   - Remove unused code
   - Refactor when patterns emerge

3. **Documentation**:
   - Update README when features change
   - Keep API documentation current
   - Document breaking changes

### Dependency Updates

1. Check for security vulnerabilities: `npm audit`
2. Update dependencies: `npm update`
3. Test thoroughly after updates
4. Check changelogs for breaking changes

## Troubleshooting

### Common Issues

**Database Connection Errors**:
- Check `POSTGRES_URL` environment variable
- Verify database is accessible
- Check connection pool limits

**Authentication Issues**:
- Verify session cookies are set
- Check session expiration
- Verify password hashing

**Performance Issues**:
- Check database query performance
- Monitor API response times
- Check for N+1 query problems
- Review pagination implementation

### Debugging Tips

1. Check browser console for client errors
2. Check server logs for API errors
3. Use database query logs
4. Use React DevTools for component debugging
5. Use Network tab for API debugging

