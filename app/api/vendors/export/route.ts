import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { isNull, eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const includeDeleted = searchParams.get('includeDeleted') === 'true';

    // Build where clause based on filters
    let whereConditions: any[] = [];

    if (!includeDeleted) {
      whereConditions.push(isNull(schema.vendors.deletedAt));
    }

    if (status && status !== 'all') {
      whereConditions.push(eq(schema.vendors.status, status as 'active' | 'inactive'));
    }

    if (category && category !== 'all') {
      whereConditions.push(eq(schema.vendors.category, category));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Fetch vendors
    const vendors = await db
      .select()
      .from(schema.vendors)
      .where(whereClause)
      .orderBy(schema.vendors.name);

    // Generate CSV
    const csvRows: string[] = [];
    
    // Header row
    csvRows.push('VENDOR,EMAIL,PHONE,CONTACT_PERSON,ADDRESS,CITY,STATE,ZIP,CATEGORY,STATUS,NOTES,SPECIALTIES');

    // Data rows
    for (const vendor of vendors) {
      const row = [
        `"${vendor.name.replace(/"/g, '""')}"`,
        vendor.email ? `"${vendor.email.replace(/"/g, '""')}"` : '',
        vendor.phone ? `"${vendor.phone.replace(/"/g, '""')}"` : '',
        vendor.contactPerson ? `"${vendor.contactPerson.replace(/"/g, '""')}"` : '',
        vendor.address ? `"${vendor.address.replace(/"/g, '""')}"` : '',
        vendor.city ? `"${vendor.city.replace(/"/g, '""')}"` : '',
        vendor.state ? `"${vendor.state.replace(/"/g, '""')}"` : '',
        vendor.zip ? `"${vendor.zip.replace(/"/g, '""')}"` : '',
        vendor.category ? `"${vendor.category.replace(/"/g, '""')}"` : '',
        vendor.status || '',
        vendor.notes ? `"${vendor.notes.replace(/"/g, '""')}"` : '',
        vendor.specialties && vendor.specialties.length > 0
          ? `"${vendor.specialties.join('; ').replace(/"/g, '""')}"`
          : '',
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="vendors-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('[Vendors Export] Error exporting vendors:', error);
    return NextResponse.json(
      { error: 'Failed to export vendors', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

