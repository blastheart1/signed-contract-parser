# Trash Cleanup System

## Overview

The system implements a soft delete mechanism for customers with automatic permanent deletion after 30 days.

## Features

1. **Soft Delete**: Customers are moved to trash (marked with `deletedAt` timestamp) instead of being permanently deleted
2. **Recovery**: Deleted customers can be recovered from trash within 30 days
3. **Automatic Cleanup**: Customers in trash for more than 30 days are permanently deleted

## Database Schema

The `customers` table includes a `deletedAt` field:
- `deletedAt: timestamp | null` - When set, the customer is in trash
- `null` means the customer is active

## API Endpoints

### Delete Customer
```
DELETE /api/customers/[id]
```
Moves customer to trash by setting `deletedAt` timestamp.

### Recover Customer
```
POST /api/customers/[id]/recover
```
Recovers customer from trash by clearing `deletedAt`.

### Cleanup Trash
```
POST /api/customers/cleanup-trash
```
Permanently deletes customers that have been in trash for more than 30 days.

**Authorization**: Requires `CLEANUP_API_TOKEN` environment variable (if set).

## Setting Up Automatic Cleanup

### Option 1: Vercel Cron Jobs (Recommended)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/customers/cleanup-trash",
      "schedule": "0 2 * * *"
    }
  ]
}
```

This runs daily at 2 AM UTC.

### Option 2: External Cron Service

Use a service like:
- **cron-job.org**: Set up a daily HTTP request to `https://your-domain.com/api/customers/cleanup-trash`
- **EasyCron**: Similar setup
- **GitHub Actions**: Use a scheduled workflow

### Option 3: Manual Cleanup

You can manually trigger cleanup by calling:
```bash
curl -X POST https://your-domain.com/api/customers/cleanup-trash \
  -H "Authorization: Bearer YOUR_CLEANUP_API_TOKEN"
```

## Environment Variables

Optional (for cleanup endpoint security):
```
CLEANUP_API_TOKEN=your-secret-token-here
```

If set, the cleanup endpoint requires this token in the `Authorization: Bearer` header.

## UI Features

1. **Delete Button**: Available on customer detail page
2. **Trash View**: Accessible from customers list page ("View Trash" button)
3. **Recover Button**: Available in trash view for each deleted customer

## Data Deletion Order

When a customer is permanently deleted, related data is removed in this order:
1. Invoices (via orders)
2. Order Items (via orders)
3. Change History (via customer and orders)
4. Orders
5. Customer

This ensures referential integrity is maintained.

