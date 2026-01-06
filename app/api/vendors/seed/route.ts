import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/permissions';
import { readFileSync } from 'fs';
import { join } from 'path';
import { sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    // Check if user is admin
    const user = await getSession();
    if (!user || !isAdmin(user)) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    // Read CSV file from filesystem
    const csvPath = join(process.cwd(), 'contract-parser', 'Vendors Master List.csv');
    
    let csvContent: string;
    try {
      csvContent = readFileSync(csvPath, 'utf-8');
    } catch (error) {
      console.error('[Vendors Seed] Error reading CSV file:', error);
      return NextResponse.json(
        { error: 'Failed to read Vendors Master List.csv file' },
        { status: 500 }
      );
    }

    // Parse CSV - skip header row "VENDOR"
    const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length === 0) {
      return NextResponse.json(
        { error: 'CSV file is empty' },
        { status: 400 }
      );
    }

    // Skip first line (header)
    const vendorNames = lines.slice(1).map(line => {
      // Remove quotes if present
      return line.replace(/^"|"$/g, '').trim();
    }).filter(name => name.length > 0);

    if (vendorNames.length === 0) {
      return NextResponse.json(
        { error: 'No vendor names found in CSV file' },
        { status: 400 }
      );
    }

    console.log(`[Vendors Seed] Found ${vendorNames.length} vendor names in CSV`);

    // Insert vendors - check if exists first to skip duplicates (idempotent)
    // This ensures we only create new records, never update existing ones
    let createdCount = 0;
    let skippedCount = 0;

    for (const vendorName of vendorNames) {
      try {
        // Check if vendor already exists
        const existing = await db
          .select()
          .from(schema.vendors)
          .where(sql`${schema.vendors.name} = ${vendorName}`)
          .limit(1);

        if (existing.length > 0) {
          // Vendor already exists, skip
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
        console.error(`[Vendors Seed] Error inserting vendor "${vendorName}":`, error);
        // Continue with next vendor
        skippedCount++;
      }
    }

    console.log(`[Vendors Seed] Created ${createdCount} new vendors, skipped ${skippedCount} existing`);

    return NextResponse.json({
      success: true,
      message: `Seeded ${createdCount} new vendors, skipped ${skippedCount} existing`,
      created: createdCount,
      skipped: skippedCount,
      total: vendorNames.length,
    });
  } catch (error) {
    console.error('[Vendors Seed] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to seed vendors', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

