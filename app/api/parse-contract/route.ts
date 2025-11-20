import { NextRequest, NextResponse } from 'next/server';
import { parseEML } from '@/lib/emlParser';
import { extractOrderItems, extractLocation, isLocationValid, validateOrderItemsTotal, OrderItem } from '@/lib/tableExtractor';
import { generateSpreadsheet } from '@/lib/spreadsheetGenerator';
import { generateSpreadsheetFilename } from '@/lib/filenameGenerator';
import { fetchAndParseAddendums, validateAddendumUrl, AddendumData, fetchAddendumHTML, parseOriginalContract, extractAddendumNumber } from '@/lib/addendumParser';
import { extractContractLinks } from '@/lib/contractLinkExtractor';

/**
 * Filter items based on category inclusion flags
 * @param items - Array of order items to filter
 * @param includeMainCategories - Whether to include main category items
 * @param includeSubcategories - Whether to include subcategory items
 * @returns Filtered array of items
 */
function filterItems(
  items: OrderItem[],
  includeMainCategories: boolean,
  includeSubcategories: boolean
): OrderItem[] {
  return items.filter(item => {
    if (item.type === 'maincategory' && !includeMainCategories) {
      return false;
    }
    if (item.type === 'subcategory' && !includeSubcategories) {
      return false;
    }
    return true;
  });
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    let fileContent: Buffer;
    
    if (contentType.includes('application/json')) {
      // JSON with base64 encoded file
      const body = await request.json();
      
      if (body && body.file) {
        fileContent = Buffer.from(body.file, 'base64');
      } else if (body && body.data) {
        fileContent = Buffer.from(body.data, 'base64');
      } else {
        return NextResponse.json(
          { error: 'No file data in request. Expected "file" or "data" field with base64 content.' },
          { status: 400 }
        );
      }
      
      if (!fileContent || fileContent.length === 0) {
        return NextResponse.json(
          { error: 'No file uploaded or file is empty' },
          { status: 400 }
        );
      }
      
      // Extract addAddendum flag (optional, default: false)
      const addAddendum: boolean = body.addAddendum === true;
      
      // Extract addendumLinks array (optional, only used when addAddendum is true)
      const addendumLinks: string[] = body.addendumLinks || [];
      
      // Extract deleteExtraRows option (optional, default: false)
      const deleteExtraRows: boolean = body.deleteExtraRows === true;
      
      // Extract category inclusion flags (optional, default: true)
      const includeMainCategories: boolean = body.includeMainCategories !== false;
      const includeSubcategories: boolean = body.includeSubcategories !== false;
      
      // Extract returnData flag (optional, default: false) - if true, return JSON data instead of Excel
      const returnData: boolean = body.returnData === true;
      
      // Validate addendum links if provided
      if (addendumLinks.length > 0) {
        const invalidLinks = addendumLinks.filter(link => !validateAddendumUrl(link));
        if (invalidLinks.length > 0) {
          return NextResponse.json(
            { 
              error: 'Invalid addendum URL format',
              message: `The following links are invalid: ${invalidLinks.join(', ')}. Expected format: https://l1.prodbx.com/go/view/?...`
            },
            { status: 400 }
          );
        }
      }
      
      // Parse EML file
      const parsed = await parseEML(fileContent);
      
      // Extract location
      const location = extractLocation(parsed.text);
      
      // Validate location extraction
      const isLocationParsed = isLocationValid(location);
      
      // Debug: Log extracted location data
      console.log('[API] Extracted location:', JSON.stringify(location, null, 2));
      console.log('[API] Location parsing valid:', isLocationParsed);
      
      // Initialize processing summary
      const processingSummary: {
        originalContract: { url: string | null; status: 'success' | 'failed' | 'not_found'; error?: string };
        addendums: Array<{ url: string; status: 'success' | 'failed'; error?: string }>;
        summary: { totalLinks: number; successful: number; failed: number };
      } = {
        originalContract: { url: null, status: 'not_found' },
        addendums: [],
        summary: { totalLinks: 0, successful: 0, failed: 0 },
      };
      
      let items: ReturnType<typeof extractOrderItems> = [];
      let addendumData: AddendumData[] = [];
      
      // Auto-detect links if addAddendum checkbox is unchecked
      if (!addAddendum) {
        console.log('[API] Auto-detecting contract links from email...');
        const extractedLinks = extractContractLinks(parsed);
        console.log(`[API] Extracted links - Original Contract: ${extractedLinks.originalContractUrl || 'not found'}, Addendums: ${extractedLinks.addendumUrls.length}`);
        
        // Process Original Contract if found
        if (extractedLinks.originalContractUrl) {
          processingSummary.originalContract.url = extractedLinks.originalContractUrl;
          console.log(`[API] Found Original Contract link: ${extractedLinks.originalContractUrl}`);
          
          try {
            // Parse Original Contract using specialized parser (includes main categories)
            const originalContractHTML = await fetchAddendumHTML(extractedLinks.originalContractUrl);
            const contractId = extractAddendumNumber(extractedLinks.originalContractUrl);
            // Use parseOriginalContract to parse the Original Contract page (includes main categories)
            items = parseOriginalContract(originalContractHTML, contractId, extractedLinks.originalContractUrl);
            processingSummary.originalContract.status = 'success';
            processingSummary.summary.successful++;
            console.log(`[API] Successfully processed Original Contract: ${items.length} items`);
          } catch (error) {
            processingSummary.originalContract.status = 'failed';
            processingSummary.originalContract.error = error instanceof Error ? error.message : 'Unknown error';
            processingSummary.summary.failed++;
            console.warn(`[API] Failed to process Original Contract: ${processingSummary.originalContract.error}`);
            // Try to fall back to email HTML only if it has a table
            try {
              items = extractOrderItems(parsed.html);
              console.log('[API] Falling back to email HTML for main contract items');
            } catch (emailError) {
              // Email HTML doesn't have a table - this is expected for addendum emails
              console.warn('[API] Email HTML does not contain order items table. This is expected for addendum emails.');
              // Set items to empty array - we'll only have addendums
              items = [];
            }
          }
        } else {
          // No Original Contract link found
          console.log('[API] No Original Contract link found in email');
          // Try to use email HTML only if it has a table (for regular contract emails)
          try {
            items = extractOrderItems(parsed.html);
            console.log('[API] Using email HTML for main contract items');
          } catch (emailError) {
            // Email HTML doesn't have a table - this is expected for addendum-only emails
            console.warn('[API] Email HTML does not contain order items table. This email may only contain addendum links.');
            // Set items to empty array - we'll only have addendums
            items = [];
          }
        }
        
        // Process auto-detected addendums
        if (extractedLinks.addendumUrls.length > 0) {
          console.log(`[API] Found ${extractedLinks.addendumUrls.length} addendum link(s) in email`);
          processingSummary.summary.totalLinks = extractedLinks.addendumUrls.length;
          
          // Process each addendum and track status
          for (const url of extractedLinks.addendumUrls) {
            try {
              const addendumResult = await fetchAndParseAddendums([url]);
              if (addendumResult.length > 0) {
                addendumData.push(...addendumResult);
                processingSummary.addendums.push({ url, status: 'success' });
                processingSummary.summary.successful++;
                console.log(`[API] Successfully processed addendum: ${url}`);
              } else {
                processingSummary.addendums.push({ url, status: 'failed', error: 'No items found' });
                processingSummary.summary.failed++;
                console.warn(`[API] Failed to process addendum: ${url} - No items found`);
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              processingSummary.addendums.push({ url, status: 'failed', error: errorMessage });
              processingSummary.summary.failed++;
              console.error(`[API] Failed to process addendum: ${url} - ${errorMessage}`);
            }
          }
        } else {
          console.log('[API] No addendum links found in email');
        }
      } else {
        // Manual addendum links provided (existing behavior)
        items = extractOrderItems(parsed.html);
        
        if (addendumLinks.length > 0) {
          console.log(`[API] Processing ${addendumLinks.length} manually entered addendum link(s)...`);
          processingSummary.summary.totalLinks = addendumLinks.length;
          
          // Process each addendum and track status
          for (const url of addendumLinks) {
            try {
              const addendumResult = await fetchAndParseAddendums([url]);
              if (addendumResult.length > 0) {
                addendumData.push(...addendumResult);
                processingSummary.addendums.push({ url, status: 'success' });
                processingSummary.summary.successful++;
                console.log(`[API] Successfully processed addendum: ${url}`);
              } else {
                processingSummary.addendums.push({ url, status: 'failed', error: 'No items found' });
                processingSummary.summary.failed++;
                console.warn(`[API] Failed to process addendum: ${url} - No items found`);
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              processingSummary.addendums.push({ url, status: 'failed', error: errorMessage });
              processingSummary.summary.failed++;
              console.error(`[API] Failed to process addendum: ${url} - ${errorMessage}`);
            }
          }
        }
      }
      
      // Update total links count (include Original Contract if it was processed)
      if (processingSummary.originalContract.status !== 'not_found') {
        processingSummary.summary.totalLinks++;
      }
      
      // Apply filtering based on category inclusion flags
      const filteredItems = filterItems(items, includeMainCategories, includeSubcategories);
      const filteredAddendumData = addendumData.map(addendum => ({
        ...addendum,
        items: filterItems(addendum.items, includeMainCategories, includeSubcategories),
      }));
      
      console.log(`[API] Filtered items: ${filteredItems.length} (from ${items.length} original)`);
      console.log(`[API] Filtered addendums: ${filteredAddendumData.length} addendums with filtered items`);
      
      // Validate order items total matches Order Grand Total
      const orderItemsValidation = validateOrderItemsTotal(filteredItems, location.orderGrandTotal);
      if (!orderItemsValidation.isValid) {
        console.warn('[API] Order items total validation failed:', orderItemsValidation.message);
      }

      // If returnData is true, return JSON data instead of Excel file
      if (returnData) {
        return NextResponse.json({
          success: true,
          data: {
            location,
            items: filteredItems,
            addendums: filteredAddendumData,
            isLocationParsed, // Include validation status
            orderItemsValidation, // Include order items validation
          },
          processingSummary,
        });
      }
      
      // Generate spreadsheet with filtered data and deleteExtraRows option
      const spreadsheetBuffer = await generateSpreadsheet(filteredItems, location, filteredAddendumData, deleteExtraRows);
      
      // Generate filename based on location data
      // Format: "{Client Initial Last Name} - #{DBX Customer ID} - {Address}.xlsx"
      const filename = generateSpreadsheetFilename(location);
      
      // Debug: Log generated filename
      console.log('[API] Generated filename:', filename);
      
      // Encode filename for Content-Disposition header (RFC 5987)
      // Use both filename (fallback) and filename* (UTF-8 encoded) for maximum browser compatibility
      const encodedFilename = encodeURIComponent(filename);
      const contentDisposition = `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`;
      
      // Return file as response with processing summary in header
      return new NextResponse(spreadsheetBuffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': contentDisposition,
          'Content-Length': spreadsheetBuffer.length.toString(),
          'X-Content-Type-Options': 'nosniff',
          'X-Processing-Summary': JSON.stringify(processingSummary),
        },
      });
    } else {
      return NextResponse.json(
        { error: 'Unsupported content type. Please send JSON with base64 encoded file.' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error processing contract:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process contract',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

