import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { hasRole } from '@/lib/auth/permissions';
import { eq, isNull, isNotNull, and, or, desc, asc, like, sql, inArray } from 'drizzle-orm';
import { generateReferenceNumber } from '@/lib/services/referenceNumberGenerator';

/**
 * GET /api/order-approvals
 * List order approvals with search, sort, and pagination
 * Query params:
 *   - search: Search by reference number or vendor name
 *   - sortBy: 'reference_no' | 'vendor' | 'date_created' | 'stage' (default: 'date_created')
 *   - sortOrder: 'asc' | 'desc' (default: 'desc')
 *   - page: Page number (default: 1)
 *   - limit: Items per page (default: 20, max: 100)
 *   - trashOnly: Show only deleted approvals (default: false)
 *   - includeDeleted: Include deleted approvals (default: false)
 *   - vendor_id: Filter by vendor ID (for vendor portal)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Vendors can only see their own approvals
    const isVendor = user.role === 'vendor';
    
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'date_created';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const trashOnly = searchParams.get('trashOnly') === 'true';
    const includeDeleted = searchParams.get('includeDeleted') === 'true';
    const vendorId = searchParams.get('vendor_id');

    // Build where clause
    let whereConditions: any[] = [];

    // Trash filter
    if (trashOnly) {
      whereConditions.push(isNotNull(schema.orderApprovals.deletedAt));
    } else if (!includeDeleted) {
      whereConditions.push(isNull(schema.orderApprovals.deletedAt));
    }

    // Vendor filter (for vendor portal or specific vendor)
    if (isVendor || vendorId) {
      // For vendor users, find their vendor record by email
      if (isVendor && user.email) {
        const vendorRecord = await db
          .select()
          .from(schema.vendors)
          .where(eq(schema.vendors.email, user.email))
          .limit(1);
        
        if (vendorRecord.length > 0) {
          whereConditions.push(eq(schema.orderApprovals.vendorId, vendorRecord[0].id));
          // Vendors can only see 'negotiating' and 'approved' stages
          whereConditions.push(inArray(schema.orderApprovals.stage, ['negotiating', 'approved']));
        } else {
          // Vendor user has no vendor record - return empty
          return NextResponse.json({
            success: true,
            data: [],
            pagination: {
              page: 1,
              limit,
              total: 0,
              totalPages: 0,
            },
          });
        }
      } else if (vendorId) {
        whereConditions.push(eq(schema.orderApprovals.vendorId, vendorId));
      }
    }

    // Search filter
    if (search) {
      whereConditions.push(
        or(
          like(schema.orderApprovals.referenceNo, `%${search}%`),
          // Search by vendor name (requires join)
          sql`EXISTS (
            SELECT 1 FROM ${schema.vendors} 
            WHERE ${schema.vendors.id} = ${schema.orderApprovals.vendorId} 
            AND ${schema.vendors.name} ILIKE ${`%${search}%`}
          )`
        )
      );
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Get total count for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.orderApprovals)
      .where(whereClause);
    
    const total = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    // Build sort
    let orderBy;
    switch (sortBy) {
      case 'reference_no':
        orderBy = sortOrder === 'asc' 
          ? asc(schema.orderApprovals.referenceNo)
          : desc(schema.orderApprovals.referenceNo);
        break;
      case 'vendor':
        // Sort by vendor name requires join - for now, sort by vendor_id
        orderBy = sortOrder === 'asc'
          ? asc(schema.orderApprovals.vendorId)
          : desc(schema.orderApprovals.vendorId);
        break;
      case 'stage':
        orderBy = sortOrder === 'asc'
          ? asc(schema.orderApprovals.stage)
          : desc(schema.orderApprovals.stage);
        break;
      case 'date_created':
      default:
        orderBy = sortOrder === 'asc'
          ? asc(schema.orderApprovals.dateCreated)
          : desc(schema.orderApprovals.dateCreated);
        break;
    }

    // Fetch approvals with vendor and customer info
    const approvals = await db
      .select({
        id: schema.orderApprovals.id,
        referenceNo: schema.orderApprovals.referenceNo,
        vendorId: schema.orderApprovals.vendorId,
        vendorName: schema.vendors.name,
        customerId: schema.orderApprovals.customerId,
        customerName: schema.customers.clientName,
        orderId: schema.orderApprovals.orderId,
        stage: schema.orderApprovals.stage,
        pmApproved: schema.orderApprovals.pmApproved,
        vendorApproved: schema.orderApprovals.vendorApproved,
        dateCreated: schema.orderApprovals.dateCreated,
        sentAt: schema.orderApprovals.sentAt,
        createdBy: schema.orderApprovals.createdBy,
        updatedAt: schema.orderApprovals.updatedAt,
        deletedAt: schema.orderApprovals.deletedAt,
      })
      .from(schema.orderApprovals)
      .leftJoin(schema.vendors, eq(schema.orderApprovals.vendorId, schema.vendors.id))
      .leftJoin(schema.customers, eq(schema.orderApprovals.customerId, schema.customers.dbxCustomerId))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      success: true,
      data: approvals,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching order approvals:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch order approvals',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/order-approvals
 * Create a new order approval
 * Body: { vendorId, customerId, orderId }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Only non-vendor roles can create approvals (PM, admin, etc.)
    if (user.role === 'vendor') {
      return NextResponse.json({ error: 'Vendors cannot create approvals' }, { status: 403 });
    }

    const body = await request.json();
    const { vendorId, customerId } = body;

    if (!vendorId || !customerId) {
      return NextResponse.json(
        { error: 'Missing required fields: vendorId, customerId' },
        { status: 400 }
      );
    }

    // Verify vendor exists
    const vendor = await db
      .select()
      .from(schema.vendors)
      .where(eq(schema.vendors.id, vendorId))
      .limit(1);

    if (vendor.length === 0) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    // Verify customer exists
    const customer = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.dbxCustomerId, customerId))
      .limit(1);

    if (customer.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Generate reference number
    const referenceNo = await generateReferenceNumber();

    // Create approval (orderId is null - items will be selected in detail view)
    const [newApproval] = await db
      .insert(schema.orderApprovals)
      .values({
        referenceNo,
        vendorId,
        customerId,
        orderId: null, // Nullable - items can come from multiple orders
        stage: 'draft',
        pmApproved: false,
        vendorApproved: false,
        createdBy: user.id,
        dateCreated: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: newApproval,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating order approval:', error);
    return NextResponse.json(
      {
        error: 'Failed to create order approval',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

