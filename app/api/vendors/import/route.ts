import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Read file content
    const text = await file.text();
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    if (lines.length === 0) {
      return NextResponse.json(
        { error: 'CSV file is empty' },
        { status: 400 }
      );
    }

    // Parse CSV - skip header row if it exists
    const vendorNames: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip header row
      if (i === 0 && (line.toLowerCase() === 'vendor' || line.toLowerCase().startsWith('vendor'))) {
        continue;
      }
      
      // Remove quotes if present and trim
      const vendorName = line.replace(/^"|"$/g, '').trim();
      if (vendorName.length > 0) {
        vendorNames.push(vendorName);
      }
    }

    if (vendorNames.length === 0) {
      return NextResponse.json(
        { error: 'No vendor names found in CSV file' },
        { status: 400 }
      );
    }

    // Insert vendors - check if exists first to skip duplicates (idempotent)
    let createdCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const vendorName of vendorNames) {
      try {
        // Check if vendor already exists
        const existing = await db
          .select()
          .from(schema.vendors)
          .where(sql`${schema.vendors.name} = ${vendorName}`)
          .limit(1);

        if (existing.length > 0) {
          skippedCount++;
          continue;
        }

        // Vendor doesn't exist, create it
        await db
          .insert(schema.vendors)
          .values({
            name: vendorName,
            status: 'active',
          });

        createdCount++;
      } catch (error) {
        console.error(`[Vendors Import] Error inserting vendor "${vendorName}":`, error);
        errors.push(`Failed to import "${vendorName}"`);
        skippedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Imported ${createdCount} new vendors, skipped ${skippedCount} existing`,
      created: createdCount,
      skipped: skippedCount,
      total: vendorNames.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Vendors Import] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to import vendors', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

