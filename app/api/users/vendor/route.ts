import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * GET - Get vendor record associated with the current user (by email match)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (user.role !== 'vendor') {
      return NextResponse.json(
        { error: 'Only vendor users can access their vendor profile' },
        { status: 403 }
      );
    }

    if (!user.email) {
      return NextResponse.json(
        { error: 'User email is required to find vendor profile' },
        { status: 400 }
      );
    }

    // Find vendor by email match
    const [vendor] = await db
      .select()
      .from(schema.vendors)
      .where(
        and(
          eq(schema.vendors.email, user.email),
          isNull(schema.vendors.deletedAt)
        )
      )
      .limit(1);

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor profile not found for this user' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: vendor,
    });
  } catch (error) {
    console.error('Error fetching vendor profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendor profile', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update vendor profile (vendors can only update certain fields, not name, email, or status)
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getSession();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (user.role !== 'vendor') {
      return NextResponse.json(
        { error: 'Only vendor users can update their vendor profile' },
        { status: 403 }
      );
    }

    if (!user.email) {
      return NextResponse.json(
        { error: 'User email is required to find vendor profile' },
        { status: 400 }
      );
    }

    // Find vendor by email match
    const [existingVendor] = await db
      .select()
      .from(schema.vendors)
      .where(
        and(
          eq(schema.vendors.email, user.email),
          isNull(schema.vendors.deletedAt)
        )
      )
      .limit(1);

    if (!existingVendor) {
      return NextResponse.json(
        { error: 'Vendor profile not found for this user' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { phone, contactPerson, address, city, state, zip, category, notes, specialties } = body;

    // Build update object - vendors can only update specific fields (not name, email, status)
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (contactPerson !== undefined) updateData.contactPerson = contactPerson?.trim() || null;
    if (address !== undefined) updateData.address = address?.trim() || null;
    if (city !== undefined) updateData.city = city?.trim() || null;
    if (state !== undefined) updateData.state = state?.trim() || null;
    if (zip !== undefined) updateData.zip = zip?.trim() || null;
    if (category !== undefined) updateData.category = category?.trim() || null;
    if (notes !== undefined) updateData.notes = notes?.trim() || null;
    if (specialties !== undefined) updateData.specialties = Array.isArray(specialties) ? specialties : null;

    // Update vendor
    const [updatedVendor] = await db
      .update(schema.vendors)
      .set(updateData)
      .where(eq(schema.vendors.id, existingVendor.id))
      .returning();

    return NextResponse.json({
      success: true,
      data: updatedVendor,
    });
  } catch (error) {
    console.error('Error updating vendor profile:', error);
    return NextResponse.json(
      { error: 'Failed to update vendor profile', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

