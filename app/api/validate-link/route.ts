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
      
      // Load HTML into cheerio once for all operations
      const $ = load(html);
      const pageText = $.text();
      
      // Try to extract addendum number from page text (EXISTING CODE - unchanged)
      let addendumNumber: string | undefined = undefined;
      try {
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
        
        const detectedSections: Array<{
          type: 'original' | 'optional-package' | 'addendum';
          number?: number;
          name?: string;
          selected?: boolean; // Default selection state
          hasTable?: boolean; // NEW: Whether section has a table
          isEmpty?: boolean; // NEW: Whether table is empty
        }> = [];
        
        // Helper function to check if table exists and has items
        // Uses similar logic to addendum parser to detect actual line items
        const checkTableStatus = (): { hasTable: boolean; isEmpty: boolean } => {
          const table = $('table.pos');
          const targetTable = table.length > 0 ? table : $('table').first();
          
          if (targetTable.length === 0) {
            return { hasTable: false, isEmpty: true };
          }
          
          // Find all rows in the table
          const rows = targetTable.find('tr');
          if (rows.length === 0) {
            return { hasTable: true, isEmpty: true };
          }
          
          // First, try to extract grand total from page text (more reliable)
          // Look for "Grand Total" followed by amount pattern
          let grandTotal = 0;
          let foundGrandTotal = false;
          const pageTextLower = pageText.toLowerCase();
          const grandTotalMatch = pageText.match(/grand\s+total[:\s]*\$?\s*([0-9,]+\.?\d*)/i);
          if (grandTotalMatch && grandTotalMatch[1]) {
            const totalStr = grandTotalMatch[1].replace(/[$,]/g, '').trim();
            const parsed = parseFloat(totalStr);
            if (!isNaN(parsed)) {
              grandTotal = parsed;
              foundGrandTotal = true;
            }
          }
          
          let lineItemCount = 0;
          
          rows.each((_index, row) => {
            const $row = $(row);
            const cells = $row.find('td');
            
            // Skip empty rows
            if (cells.length === 0) {
              return;
            }
            
            const rowText = $row.text();
            const rowTextLower = rowText.toLowerCase();
            
            // Skip header row
            if (rowTextLower.includes('description') && rowTextLower.includes('qty') && rowTextLower.includes('extended')) {
              return;
            }
            
            if (cells.length >= 3) {
              const firstCell = cells.eq(0);
              const descriptionCell = firstCell;
              const qtyCell = cells.eq(1);
              const extendedCell = cells.eq(2);
              
              // Check for grand total row in table (fallback if not found in page text)
              if (!foundGrandTotal && (rowTextLower.includes('grand total') || rowTextLower.includes('current balance'))) {
                // Try extended cell first
                let amountText = extendedCell.text().trim();
                // If empty, try all cells
                if (!amountText) {
                  cells.each((idx, cell) => {
                    const cellText = $(cell).text().trim();
                    const cellMatch = cellText.replace(/[$,]/g, '').match(/-?\d+(?:\.\d+)?/);
                    if (cellMatch && !amountText) {
                      amountText = cellText;
                    }
                  });
                }
                const amountMatch = amountText.replace(/[$,]/g, '').match(/-?\d+(?:\.\d+)?/);
                if (amountMatch) {
                  grandTotal = parseFloat(amountMatch[0]) || 0;
                  foundGrandTotal = true;
                }
                return;
              }
              
              // Skip subtotal/tax rows
              const descriptionLower = descriptionCell.text().toLowerCase().trim();
              if (descriptionLower.includes('subtotal') || descriptionLower.includes('tax')) {
                return;
              }
              
              // Check if this is a subcategory (class "ssg_title")
              const isSubCategory = $row.hasClass('ssg_title') || 
                                   firstCell.hasClass('ssg_title') ||
                                   firstCell.attr('class')?.includes('ssg_title') ||
                                   $row.hasClass('subcategory') ||
                                   firstCell.attr('class')?.includes('subcategory');
              
              if (isSubCategory) {
                return; // Skip subcategories
              }
              
              // Check if this is a main category (category code pattern like "0100 Calimingo")
              const categoryText = descriptionCell.text().trim();
              const categoryCodePattern = /^\s*\d{4}\s+Calimingo/i;
              const hasCategoryCode = categoryCodePattern.test(categoryText);
              
              // Check for bold formatting (main categories are usually bold)
              const firstCellHtml = firstCell.html() || '';
              const isBold = firstCellHtml.includes('font-weight: bold') ||
                            firstCellHtml.includes('font-size: 14px') ||
                            firstCell.find('span[style*="font-weight: bold"]').length > 0 ||
                            firstCell.find('span[style*="font-size: 14px"]').length > 0 ||
                            firstCell.find('strong').length > 0 ||
                            firstCell.find('b').length > 0;
              
              const hasQtyAndExtended = qtyCell.text().trim() && extendedCell.text().trim();
              
              // Skip main categories (they have category code pattern and qty/extended)
              if ((hasCategoryCode && hasQtyAndExtended) || (isBold && hasQtyAndExtended)) {
                return; // Skip main category rows
              }
              
              // This should be a line item - check if it has meaningful data
              const description = descriptionCell.text().trim();
              if (description && description.length > 0) {
                const extendedText = extendedCell.text().trim();
                const amountMatch = extendedText.replace(/[$,]/g, '').match(/-?\d+(?:\.\d+)?/);
                if (amountMatch) {
                  const amount = parseFloat(amountMatch[0]) || 0;
                  // Count as line item if it has a description and amount (even if amount is 0, it's still a line item)
                  lineItemCount++;
                } else if (description.length > 0) {
                  // Has description but no amount - still count as a line item
                  lineItemCount++;
                }
              }
            }
          });
          
          // Table is empty if:
          // 1. Grand total is 0 (if grand total found and is 0, flag it - most reliable indicator), OR
          // 2. No line items found
          const isEmpty = (foundGrandTotal && grandTotal === 0) || lineItemCount === 0;
          
          return { hasTable: true, isEmpty };
        };
        
        // Check for addendum FIRST (addendums are separate pages, not combined with original)
        const addendumMatch = pageText.match(/Addendum\s*#\s*:?\s*(\d+)/i);
        let hasAddendum = false;
        if (addendumMatch && addendumMatch[1]) {
          const addendumNumStr = addendumMatch[1].trim();
          const addendumNum = parseInt(addendumNumStr, 10);
          if (!isNaN(addendumNum) && addendumNum > 0) {
            hasAddendum = true;
            const tableStatus = checkTableStatus();
            detectedSections.push({
              type: 'addendum',
              number: addendumNum,
              selected: false, // Addendums are unchecked by default for reupload
              hasTable: tableStatus.hasTable,
              isEmpty: tableStatus.isEmpty,
            });
          }
        }
        
        // Only check for original contract if NO addendum was found
        // (Addendums are separate pages, they don't contain original contract)
        if (!hasAddendum) {
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
            const tableStatus = checkTableStatus();
            detectedSections.push({
              type: 'original',
              selected: true, // Original contract is selected by default
              hasTable: tableStatus.hasTable,
              isEmpty: tableStatus.isEmpty,
            });
          }
        }
        
        // Find ALL optional packages in the link (can exist in both original and addendum pages)
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
          const tableStatus = checkTableStatus();
          detectedSections.push({
            type: 'optional-package',
            number: pkg.number,
            name: pkg.name,
            selected: false, // Optional packages are NOT selected by default
            hasTable: tableStatus.hasTable,
            isEmpty: tableStatus.isEmpty,
          });
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
