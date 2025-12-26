import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, isNull, and, isNotNull, desc, or, like, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const includeDeleted = searchParams.get('includeDeleted') === 'true';
    const trashOnly = searchParams.get('trashOnly') === 'true';

    // Build where clause based on filters
    let whereConditions: any[] = [];

    // Handle deleted filter
    if (trashOnly) {
      // Only show deleted vendors (in trash)
      whereConditions.push(isNotNull(schema.vendors.deletedAt));
    } else if (!includeDeleted) {
      // Default: exclude deleted vendors
      whereConditions.push(isNull(schema.vendors.deletedAt));
    }
    // If includeDeleted is true and not trashOnly, show all (no deleted filter)

    // Add status filter if provided
    if (status && status !== 'all') {
      whereConditions.push(eq(schema.vendors.status, status as 'active' | 'inactive'));
    } else if (!trashOnly && !includeDeleted) {
      // Default: only show active vendors unless explicitly requested
      whereConditions.push(eq(schema.vendors.status, 'active'));
    }

    // Add category filter if provided
    if (category && category !== 'all') {
      whereConditions.push(eq(schema.vendors.category, category));
    }

    // Add search filter if provided
    if (search) {
      const searchPattern = `%${search}%`;
      whereConditions.push(
        or(
          like(schema.vendors.name, searchPattern),
          like(schema.vendors.email, searchPattern),
          like(schema.vendors.phone, searchPattern)
        )!
      );
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Fetch vendors with filters, sorted by name
    const vendors = await db
      .select()
      .from(schema.vendors)
      .where(whereClause)
      .orderBy(schema.vendors.name);

    // Calculate pagination
    const total = vendors.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedVendors = vendors.slice(startIndex, endIndex);

    return NextResponse.json({
      success: true,
      data: paginatedVendors,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('[Vendors API] Error fetching vendors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendors', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, contactPerson, address, city, state, zip, category, status, notes, specialties } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Vendor name is required' },
        { status: 400 }
      );
    }

    // Check if vendor with same name already exists
    const existing = await db
      .select()
      .from(schema.vendors)
      .where(eq(schema.vendors.name, name.trim()))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Vendor with this name already exists' },
        { status: 409 }
      );
    }

    // Create new vendor
    const [newVendor] = await db
      .insert(schema.vendors)
      .values({
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        contactPerson: contactPerson?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        zip: zip?.trim() || null,
        category: category?.trim() || null,
        status: (status as 'active' | 'inactive') || 'active',
        notes: notes?.trim() || null,
        specialties: Array.isArray(specialties) ? specialties : null,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: newVendor,
    }, { status: 201 });
  } catch (error) {
    console.error('[Vendors API] Error creating vendor:', error);
    return NextResponse.json(
      { error: 'Failed to create vendor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

