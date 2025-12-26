import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const vendorId = params.id;

    const [vendor] = await db
      .select()
      .from(schema.vendors)
      .where(eq(schema.vendors.id, vendorId))
      .limit(1);

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: vendor,
    });
  } catch (error) {
    console.error('[Vendors API] Error fetching vendor:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const vendorId = params.id;
    const body = await request.json();
    const { name, email, phone, contactPerson, address, city, state, zip, category, status, notes, specialties } = body;

    // Check if vendor exists
    const [existing] = await db
      .select()
      .from(schema.vendors)
      .where(eq(schema.vendors.id, vendorId))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    // If name is being changed, check for duplicates
    if (name && name.trim() !== existing.name) {
      const duplicate = await db
        .select()
        .from(schema.vendors)
        .where(eq(schema.vendors.name, name.trim()))
        .limit(1);

      if (duplicate.length > 0) {
        return NextResponse.json(
          { error: 'Vendor with this name already exists' },
          { status: 409 }
        );
      }
    }

    // Update vendor
    const [updatedVendor] = await db
      .update(schema.vendors)
      .set({
        name: name?.trim() || existing.name,
        email: email !== undefined ? (email?.trim() || null) : existing.email,
        phone: phone !== undefined ? (phone?.trim() || null) : existing.phone,
        contactPerson: contactPerson !== undefined ? (contactPerson?.trim() || null) : existing.contactPerson,
        address: address !== undefined ? (address?.trim() || null) : existing.address,
        city: city !== undefined ? (city?.trim() || null) : existing.city,
        state: state !== undefined ? (state?.trim() || null) : existing.state,
        zip: zip !== undefined ? (zip?.trim() || null) : existing.zip,
        category: category !== undefined ? (category?.trim() || null) : existing.category,
        status: status !== undefined ? (status as 'active' | 'inactive') : existing.status,
        notes: notes !== undefined ? (notes?.trim() || null) : existing.notes,
        specialties: specialties !== undefined ? (Array.isArray(specialties) ? specialties : null) : existing.specialties,
        updatedAt: new Date(),
      })
      .where(eq(schema.vendors.id, vendorId))
      .returning();

    return NextResponse.json({
      success: true,
      data: updatedVendor,
    });
  } catch (error) {
    console.error('[Vendors API] Error updating vendor:', error);
    return NextResponse.json(
      { error: 'Failed to update vendor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const vendorId = params.id;

    // Check if vendor exists
    const [existing] = await db
      .select()
      .from(schema.vendors)
      .where(eq(schema.vendors.id, vendorId))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    // Soft delete: set deletedAt timestamp
    const [deletedVendor] = await db
      .update(schema.vendors)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.vendors.id, vendorId))
      .returning();

    return NextResponse.json({
      success: true,
      data: deletedVendor,
      message: 'Vendor deleted successfully',
    });
  } catch (error) {
    console.error('[Vendors API] Error deleting vendor:', error);
    return NextResponse.json(
      { error: 'Failed to delete vendor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

