import { NextRequest, NextResponse } from 'next/server';
import { validateAddendumUrl, fetchAddendumHTML, extractAddendumNumber } from '@/lib/addendumParser';
import { load } from 'cheerio';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate format
    if (!validateAddendumUrl(url.trim())) {
      return NextResponse.json(
        { 
          valid: false,
          error: 'Invalid URL format. Expected format: https://l1.prodbx.com/go/view/?...'
        },
        { status: 200 } // Return 200 with valid: false, not an error status
      );
    }

    // Validate accessibility by attempting to fetch and extract addendum number
    try {
      const html = await fetchAddendumHTML(url.trim());
      
      // Try to extract addendum number from page text (EXISTING CODE - unchanged)
      let addendumNumber: string | undefined = undefined;
      try {
        const $ = load(html);
        const pageText = $.text();
        const addendumMatch = pageText.match(/Addendum\s*#\s*:?\s*(\d+)/i);
        if (addendumMatch && addendumMatch[1]) {
          addendumNumber = addendumMatch[1].trim();
        } else {
          // Fallback to URL extraction
          addendumNumber = extractAddendumNumber(url.trim());
        }
      } catch (parseError) {
        // Fallback to URL extraction if page parsing fails
        try {
          addendumNumber = extractAddendumNumber(url.trim());
        } catch (urlError) {
          // If both fail, leave as undefined
        }
      }
      
      // NEW: Detect ALL sections present in the link (original contract, optional packages, addendums)
      // Return an array of detected sections so user can select which ones to include
      try {
        const $ = load(html);
        const pageText = $.text();
        
        const detectedSections: Array<{
          type: 'original' | 'optional-package' | 'addendum';
          number?: number;
          name?: string;
          selected?: boolean; // Default selection state
        }> = [];
        
        // Check for contract markers to determine if there's an original contract section
        const contractMarkers = [
          /CONTRACT\s*#/i,
          /Project\s+Information/i,
          /CONTRACT\s+PRICE/i,
          /DESCRIPTION\s+QTY/i,
        ];
        
        let hasOriginalContract = false;
        for (const marker of contractMarkers) {
          if (marker.test(pageText)) {
            hasOriginalContract = true;
            break;
          }
        }
        
        // If original contract is present, add it (selected by default)
        if (hasOriginalContract) {
          detectedSections.push({
            type: 'original',
            selected: true, // Original contract is selected by default
          });
        }
        
        // Find ALL optional packages in the link
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
              console.warn('[Validate Link] Failed to extract optional package name:', nameError);
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
        
        // Check for addendum
        const addendumMatch = pageText.match(/Addendum\s*#\s*:?\s*(\d+)/i);
        if (addendumMatch && addendumMatch[1]) {
          const addendumNumStr = addendumMatch[1].trim();
          const addendumNum = parseInt(addendumNumStr, 10);
          if (!isNaN(addendumNum) && addendumNum > 0) {
            detectedSections.push({
              type: 'addendum',
              number: addendumNum,
              selected: true, // Addendums are selected by default (existing behavior)
            });
          }
        }
        
        // If no sections detected, default to original contract (backward compatibility)
        if (detectedSections.length === 0) {
          detectedSections.push({
            type: 'original',
            selected: true,
          });
        }
        
        // Return with sections array
        return NextResponse.json({
          valid: true, // EXISTING field
          addendumNumber: addendumNumber, // EXISTING field (for backward compatibility)
          // NEW: Array of detected sections
          sections: detectedSections,
          // NEW: For backward compatibility, also include single type (first section)
          type: detectedSections[0]?.type || 'original',
          number: detectedSections[0]?.number,
          name: detectedSections[0]?.name,
        });
      } catch (detectionError) {
        // If detection fails, return existing format (graceful degradation)
        console.warn('[Validate Link] Type detection failed, using default:', detectionError);
        return NextResponse.json({
          valid: true,
          addendumNumber: addendumNumber,
          // Return default original contract section
          sections: [{ type: 'original', selected: true }],
          type: 'original',
        });
      }
    } catch (error) {
      // Even if fetch fails, try to extract from URL as fallback
      let addendumNumber: string | undefined = undefined;
      try {
        addendumNumber = extractAddendumNumber(url.trim());
      } catch (urlError) {
        // If extraction fails, leave as undefined
      }
      
      // Return error response (no type detection possible if fetch failed)
      return NextResponse.json({
        valid: false,
        error: error instanceof Error ? error.message : 'Failed to access link',
        addendumNumber: addendumNumber, // Still return URL-based number if available
        // type field omitted (can't detect without HTML)
      }, { status: 200 }); // Return 200 with valid: false
    }
  } catch (error) {
    return NextResponse.json(
      {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
