import { NextRequest, NextResponse } from 'next/server';
import { parseEML } from '@/lib/emlParser';
import { load } from 'cheerio';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { file } = body; // base64 encoded EML file

    if (!file || typeof file !== 'string') {
      return NextResponse.json(
        { error: 'EML file content is required' },
        { status: 400 }
      );
    }

    // Parse EML file
    const buffer = Buffer.from(file, 'base64');
    const parsed = await parseEML(buffer);
    const html = parsed.html;

    if (!html || html.trim().length === 0) {
      return NextResponse.json({
        sections: [],
        hasTable: false,
      });
    }

    // Load HTML into cheerio
    const $ = load(html);
    const pageText = $.text();

    // Check if table exists (either class="pos" or any table)
    const hasTable = $('table.pos').length > 0 || $('table').length > 0;

    const detectedSections: Array<{
      type: 'original' | 'optional-package' | 'addendum';
      number?: number;
      name?: string;
      selected?: boolean;
    }> = [];

    // If table exists, original contract is present
    if (hasTable) {
      detectedSections.push({
        type: 'original',
        selected: true, // Original contract is selected by default
      });
    }

    // Find ALL optional packages in the HTML (same regex as validate-link)
    const optionalPackageRegex = /-OPTIONAL\s+PACKAGE\s+(\d+)-/gi;
    let optionalPackageMatch;
    const optionalPackages: Array<{ number: number; name?: string }> = [];

    while ((optionalPackageMatch = optionalPackageRegex.exec(pageText)) !== null) {
      const packageNumber = parseInt(optionalPackageMatch[1], 10);
      if (!isNaN(packageNumber) && packageNumber > 0) {
        // Try to extract package name
        let packageName: string | undefined = undefined;
        try {
          const nameMatch = pageText.substring(optionalPackageMatch.index).match(/-OPTIONAL\s+PACKAGE\s+\d+-\s*([^\n]+)/i);
          if (nameMatch && nameMatch[1]) {
            packageName = nameMatch[1].trim().substring(0, 100);
          }
        } catch (nameError) {
          console.warn('[Detect EML Sections] Failed to extract optional package name:', nameError);
        }
        
        optionalPackages.push({ number: packageNumber, name: packageName });
      }
    }

    // Add each optional package (NOT selected by default)
    for (const pkg of optionalPackages) {
      detectedSections.push({
        type: 'optional-package',
        number: pkg.number,
        name: pkg.name,
        selected: false, // Optional packages are NOT selected by default
      });
    }

    // Check for addendum in HTML (if present)
    const addendumMatch = pageText.match(/Addendum\s*#\s*:?\s*(\d+)/i);
    if (addendumMatch && addendumMatch[1]) {
      const addendumNumStr = addendumMatch[1].trim();
      const addendumNum = parseInt(addendumNumStr, 10);
      if (!isNaN(addendumNum) && addendumNum > 0) {
        detectedSections.push({
          type: 'addendum',
          number: addendumNum,
          selected: true, // Addendums are selected by default
        });
      }
    }

    return NextResponse.json({
      sections: detectedSections,
      hasTable: hasTable,
    });
  } catch (error) {
    console.error('[Detect EML Sections] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        sections: [],
        hasTable: false,
      },
      { status: 500 }
    );
  }
}
