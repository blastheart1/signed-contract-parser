import { NextRequest, NextResponse } from 'next/server';
import { parseEML } from '@/lib/emlParser';
import { extractOrderItems, extractLocation, isLocationValid, validateOrderItemsTotal, OrderItem } from '@/lib/tableExtractor';
import { generateSpreadsheet } from '@/lib/spreadsheetGenerator';
import { generateSpreadsheetFilename } from '@/lib/filenameGenerator';
import { fetchAndParseAddendums, validateAddendumUrl, AddendumData, fetchAddendumHTML, parseOriginalContract, extractAddendumNumber } from '@/lib/addendumParser';
import { extractContractLinks } from '@/lib/contractLinkExtractor';
import { put } from '@vercel/blob';
import { load } from 'cheerio';
import { normalizeToMmddyyyy } from '@/lib/utils/dateFormat';

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

// Handle CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const body = await request.json();
      
      // Extract mode (optional, defaults to 'eml' for backward compatibility)
      const mode: 'links' | 'eml' = body.mode === 'links' ? 'links' : 'eml';
      
      // Extract common options (same for both modes)
      const deleteExtraRows: boolean = body.deleteExtraRows === true;
      const includeMainCategories: boolean = body.includeMainCategories !== false;
      const includeSubcategories: boolean = body.includeSubcategories !== false;
      const returnData: boolean = body.returnData === true;
      const includeOriginalContract: boolean = body.includeOriginalContract !== false; // Default: true for backward compatibility
      const existingContractId: string | undefined = body.existingContractId;
      
      // LINKS-ONLY MODE: Process without .eml file
      if (mode === 'links') {
        // NEW: Extract links from selectedLinks array (backward compatible)
        let originalContractUrl: string = '';
        let addendumLinks: string[] = [];
        let optionalPackageLinks: Array<{ url: string; number: number }> = [];
        
        if (body.selectedLinks && Array.isArray(body.selectedLinks)) {
          // NEW: Process selectedLinks - group by URL to avoid duplicate parsing
          const urlSections = new Map<string, Array<{ type: string; number?: number }>>();
          
          body.selectedLinks.forEach((link: any) => {
            if (!link.url || typeof link.url !== 'string') return;
            
            if (!urlSections.has(link.url)) {
              urlSections.set(link.url, []);
            }
            urlSections.get(link.url)!.push({
              type: link.type,
              number: link.number,
            });
          });
          
          // Process grouped sections
          for (const [url, sections] of urlSections.entries()) {
            const hasOriginal = sections.some(s => s.type === 'original');
            const hasAddendum = sections.some(s => s.type === 'addendum');
            const optionalPackages = sections.filter(s => s.type === 'optional-package');
            
            if (hasOriginal) {
              originalContractUrl = url;
            }
            if (hasAddendum) {
              addendumLinks.push(url);
            }
            optionalPackages.forEach(pkg => {
              if (pkg.number && pkg.number > 0) {
                optionalPackageLinks.push({ url, number: pkg.number });
              }
            });
          }
        } else {
          // EXISTING: Fall back to old format (backward compatibility)
          originalContractUrl = body.originalContractUrl || '';
          addendumLinks = body.addendumLinks || [];
        }
        
        // Validate that we have at least one link to process
        const hasOriginalContract = originalContractUrl && validateAddendumUrl(originalContractUrl);
        const hasAddendums = addendumLinks.length > 0;
        const hasOptionalPackages = optionalPackageLinks.length > 0;
        
        if (!hasOriginalContract && !hasAddendums && !hasOptionalPackages) {
          return NextResponse.json(
            { error: 'At least one valid link is required (original contract, addendum, or optional package)' },
            { status: 400 }
          );
        }
        
        // Original Contract is only required if includeOriginalContract is true
        if (includeOriginalContract && !hasOriginalContract) {
          return NextResponse.json(
            { error: 'Valid originalContractUrl is required when includeOriginalContract is true' },
            { status: 400 }
          );
        }
        
        // Validate all link formats
        const allLinks = [
          ...(originalContractUrl ? [originalContractUrl] : []),
          ...addendumLinks,
          ...optionalPackageLinks.map(p => p.url),
        ];
        const invalidLinks = allLinks.filter(link => !validateAddendumUrl(link));
          if (invalidLinks.length > 0) {
            return NextResponse.json(
              { 
              error: 'Invalid URL format',
                message: `The following links are invalid: ${invalidLinks.join(', ')}. Expected format: https://l1.prodbx.com/go/view/?...`
              },
              { status: 400 }
            );
        }
        
        // Process links-only mode
        const processingSummary: {
          originalContract: { url: string | null; status: 'success' | 'failed' | 'not_found'; error?: string };
          addendums: Array<{ url: string; status: 'success' | 'failed'; error?: string }>;
          summary: { totalLinks: number; successful: number; failed: number };
        } = {
          originalContract: { url: originalContractUrl, status: 'not_found' },
          addendums: [],
          summary: { totalLinks: 0, successful: 0, failed: 0 },
        };
        
        let items: ReturnType<typeof extractOrderItems> = [];
        let addendumData: AddendumData[] = [];
        let location: ReturnType<typeof extractLocation> = {
          orderNo: '',
          streetAddress: '',
          city: '',
          state: '',
          zip: '',
        };
        
        // Fetch existing contract items if existingContractId is provided
        let existingItems: any[] = [];
        if (existingContractId) {
          try {
            const { db, schema } = await import('@/lib/db');
            const { convertDatabaseToStoredContract } = await import('@/lib/db/contractHelpers');
            const { eq } = await import('drizzle-orm');
            
            // Try to find contract by ID
            const order = await db
              .select()
              .from(schema.orders)
              .where(eq(schema.orders.id, existingContractId))
              .limit(1)
              .then(rows => rows[0]);
            
            if (order) {
              const orderItems = await db
                .select()
                .from(schema.orderItems)
                .where(eq(schema.orderItems.orderId, order.id));
              
              const customer = await db
                .select()
                .from(schema.customers)
                .where(eq(schema.customers.dbxCustomerId, order.customerId))
                .limit(1)
                .then(rows => rows[0]);
              
              if (customer) {
                const existingContract = convertDatabaseToStoredContract(customer, order, orderItems);
                existingItems = existingContract.items || [];
                console.log(`[API] Found existing contract with ${existingItems.length} items`);
              }
            }
          } catch (fetchError) {
            console.warn(`[API] Could not fetch existing contract: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
          }
        }
        
        // Process Original Contract (if selected)
        if (originalContractUrl) {
        try {
          const originalContractHTML = await fetchAddendumHTML(originalContractUrl);
          const contractId = extractAddendumNumber(originalContractUrl);
          
          // Parse items from Original Contract HTML using existing function
            // This will parse ALL items including optional packages, but optional packages will be marked
            const allItems = parseOriginalContract(originalContractHTML, contractId, originalContractUrl);
            
            console.log(`[API] Parsed ${allItems.length} total items from original contract`);
            const optionalItems = allItems.filter(item => item.isOptional);
            const originalItems = allItems.filter(item => !item.isOptional);
            console.log(`[API] Found ${originalItems.length} original contract items and ${optionalItems.length} optional package items`);
            
            // NEW: Filter items to include only original contract items (exclude optional packages if not selected)
            // Check if optional packages from this URL are selected
            const selectedOptionalPackages = optionalPackageLinks
              .filter(pkg => pkg.url === originalContractUrl)
              .map(pkg => pkg.number);
            
            console.log(`[API] Selected optional packages: ${selectedOptionalPackages.length > 0 ? selectedOptionalPackages.join(', ') : 'none'}`);
            
            if (selectedOptionalPackages.length > 0) {
              // Include original contract items + selected optional package items
              items = allItems.filter(item => 
                !item.isOptional || (item.isOptional && item.optionalPackageNumber && selectedOptionalPackages.includes(item.optionalPackageNumber))
              );
              console.log(`[API] Filtered to ${items.length} items (original + selected optional packages)`);
            } else {
              // Only include original contract items (exclude all optional packages)
              items = allItems.filter(item => !item.isOptional);
              console.log(`[API] Filtered to ${items.length} items (original contract only, excluding all optional packages)`);
            }
          
          // Try to extract location from contract HTML text using existing function
          try {
            // extractLocation expects email text, but we can try with HTML text
            // If it doesn't work, location will be mostly empty (acceptable per requirements)
            const locationText = originalContractHTML; // Use HTML as text, extractLocation will try to parse it
            const extractedLocation = extractLocation(locationText);
            if (extractedLocation.orderNo || extractedLocation.streetAddress) {
              location = extractedLocation;
            }
          } catch (locError) {
            console.warn('[API] Could not extract location from contract HTML, location will be incomplete');
            // Location remains with empty/default values - acceptable per requirements
          }
          
          processingSummary.originalContract.status = 'success';
          processingSummary.summary.successful++;
          processingSummary.summary.totalLinks++;
        } catch (error) {
          processingSummary.originalContract.status = 'failed';
          processingSummary.originalContract.error = error instanceof Error ? error.message : 'Unknown error';
          processingSummary.summary.failed++;
          processingSummary.summary.totalLinks++;
          throw new Error(`Failed to process Original Contract: ${processingSummary.originalContract.error}`);
        }
        } else {
          // Skip original contract processing
          console.log('[API] Skipping original contract processing (not selected)');
          processingSummary.originalContract.status = 'not_found';
        }
        
        // NEW: Process Optional Packages (only if not already included from original contract parsing)
        // Group by URL to avoid duplicate parsing
        const standaloneOptionalPackages = optionalPackageLinks.filter(pkg => pkg.url !== originalContractUrl);
        
        if (standaloneOptionalPackages.length > 0) {
          processingSummary.summary.totalLinks += standaloneOptionalPackages.length;
          
          for (const pkgLink of standaloneOptionalPackages) {
            try {
              const pkgHTML = await fetchAddendumHTML(pkgLink.url);
              const contractId = `optional-package-${pkgLink.number}`;
              
              // Use existing parseOriginalContract function (it works for any contract HTML)
              // CRITICAL: This is the existing parsing function, called as-is
              const pkgItems = parseOriginalContract(pkgHTML, contractId, pkgLink.url);
              
              // NEW: Mark all items as optional (metadata addition, not parsing change)
              const markedItems = pkgItems.map(item => ({
                ...item, // Preserve all existing fields
                isOptional: true, // NEW: Add optional flag
                optionalPackageNumber: pkgLink.number, // NEW: Add package number
              }));
              
              // Add to items array
              items.push(...markedItems);
              
              processingSummary.summary.successful++;
            } catch (error) {
              console.error(`[API] Failed to parse optional package ${pkgLink.number}:`, error);
              processingSummary.summary.failed++;
              // Continue with other packages (graceful degradation)
            }
          }
        }
        
        // Process Addendums (EXISTING CODE - NO CHANGES)
        if (addendumLinks.length > 0) {
          processingSummary.summary.totalLinks += addendumLinks.length;
          
          for (const url of addendumLinks) {
            try {
              const addendumResult = await fetchAndParseAddendums([url]);
              if (addendumResult.length > 0) {
                addendumData.push(...addendumResult);
                processingSummary.addendums.push({ url, status: 'success' });
                processingSummary.summary.successful++;
              } else {
                processingSummary.addendums.push({ url, status: 'failed', error: 'No items found' });
                processingSummary.summary.failed++;
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              processingSummary.addendums.push({ url, status: 'failed', error: errorMessage });
              processingSummary.summary.failed++;
            }
          }
        }
        
        // Merge with existing contract items if existingContractId is provided and only addendums/optional packages were processed
        // CRITICAL: This preserves ALL existing item data including progress updates, invoice links, and any user modifications
        // We only APPEND new addendum/optional package items - we never modify or overwrite existing items
        // Removed !includeOriginalContract requirement - merge should happen for reupload even if items is empty
        const hasNewItems = addendumData.length > 0 || optionalPackageLinks.length > 0;
        if (existingContractId && existingItems.length > 0 && hasNewItems) {
          console.log(`[API] Merging ${addendumData.length} addendum(s) with ${existingItems.length} existing items`);
          console.log(`[API] CRITICAL: Preserving all existing item properties (progress fields, invoice links, etc.)`);
          // Combine: existing items + 1 blank row + new addendum items
          // Using spread operator creates new array but preserves all item object properties (shallow copy is safe since we don't modify items)
          const mergedItems: any[] = existingItems.map(item => ({ ...item })); // Deep copy each item to ensure no accidental modifications
          
          // Add exactly 1 blank row before new items
          mergedItems.push({
            type: 'item',
            productService: '',
            qty: '',
            rate: '',
            amount: '',
            columnBLabel: 'Initial',
            isBlankRow: true,
          });
          
          // NEW: Add optional package items (already marked with metadata)
          // Optional package items are already in the items array with isOptional flag
          if (items.length > 0) {
            // Filter for optional package items
            const optionalItems = items.filter(item => item.isOptional === true);
            if (optionalItems.length > 0) {
              mergedItems.push(...optionalItems);
            }
          }
          
          // Add addendum items
          addendumData.forEach((addendum: AddendumData) => {
            const addendumNum = addendum.addendumNumber;
            const urlId = addendum.urlId || addendum.addendumNumber;
            const headerText = `Addendum #${addendumNum} (${urlId})`;
            
            mergedItems.push({
              type: 'maincategory',
              productService: headerText,
              qty: '',
              rate: '',
              amount: '',
              columnBLabel: 'Addendum',
              isAddendumHeader: true,
              addendumNumber: addendumNum,
              addendumUrlId: urlId,
            });
            
            addendum.items.forEach((item: any) => {
              mergedItems.push({
                ...item,
                columnBLabel: 'Addendum',
              });
            });
          });
          
          // Replace items with merged items
          items = mergedItems as any;
          console.log(`[API] Merged items total: ${items.length}`);
        }
        
        // Apply filtering
        const filteredItems = filterItems(items, includeMainCategories, includeSubcategories);
        const filteredAddendumData = addendumData.map(addendum => ({
          ...addendum,
          items: filterItems(addendum.items, includeMainCategories, includeSubcategories),
        }));
        
        // Sort addendums by number in ascending order
        const sortedAddendumData = [...filteredAddendumData].sort((a, b) => {
          const numA = parseInt(a.addendumNumber || '0', 10);
          const numB = parseInt(b.addendumNumber || '0', 10);
          return numA - numB; // Ascending order
        });
        
        // Validate order items (if orderGrandTotal is available in location)
        const orderItemsValidation = validateOrderItemsTotal(
          filteredItems, 
          location.orderGrandTotal || 0
        );
        
        // Add contractDate to location object if orderDate exists
        const locationWithContractDate = {
          ...location,
          contractDate: location.orderDate ? normalizeToMmddyyyy(location.orderDate) : null,
        };
        
        // Return data (same structure as EML mode)
        return NextResponse.json({
          success: true,
          data: {
            location: locationWithContractDate,
            items: filteredItems,
            addendums: sortedAddendumData,
            isLocationParsed: isLocationValid(location),
            orderItemsValidation,
          },
          processingSummary,
        });
      }
      
      // EML MODE: Existing behavior (unchanged)
      let fileContent: Buffer;
      
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
      
      // Extract addAddendum flag (optional, default: false) - for backward compatibility
      const addAddendum: boolean = body.addAddendum === true;
      
      // NEW: Extract parseOriginalContractFromTable and selectedSections
      const parseOriginalContractFromTable: boolean = body.parseOriginalContractFromTable === true;
      const selectedSections: Array<{
        source: 'eml-table' | 'link';
        type: 'original' | 'optional-package' | 'addendum';
        number?: number;
        url?: string;
      }> = body.selectedSections || [];
      
      // NEW: Extract links from selectedLinks array (backward compatible)
      // Changed to track addendum numbers for filtering
      let addendumLinks: Array<{ url: string; number?: number }> = [];
      let originalContractUrlFromBody: string | undefined = undefined;
      let optionalPackageLinks: Array<{ url: string; number: number }> = [];
      
      // Process selectedSections if provided (new format)
      if (selectedSections.length > 0) {
        selectedSections.forEach((section) => {
          if (section.source === 'link' && section.url) {
            if (section.type === 'original') {
              originalContractUrlFromBody = section.url;
            } else if (section.type === 'addendum') {
              // Track addendum number to filter results later
              addendumLinks.push({ url: section.url, number: section.number });
            } else if (section.type === 'optional-package' && section.number) {
              optionalPackageLinks.push({ url: section.url, number: section.number });
            }
          }
        });
      } else if (body.selectedLinks && Array.isArray(body.selectedLinks)) {
        // NEW: Process selectedLinks (fallback)
        body.selectedLinks.forEach((link: any) => {
          if (!link.url || typeof link.url !== 'string') return;
          
          if (link.type === 'original') {
            originalContractUrlFromBody = link.url;
          } else if (link.type === 'addendum') {
            // Track addendum number to filter results later
            addendumLinks.push({ url: link.url, number: link.number });
          } else if (link.type === 'optional-package') {
            const pkgNumber = typeof link.number === 'number' ? link.number : 0;
            if (pkgNumber > 0) {
              optionalPackageLinks.push({ url: link.url, number: pkgNumber });
            }
          }
        });
      } else {
        // EXISTING: Fall back to old format (backward compatibility)
        // Convert string array to new format
        const oldAddendumLinks = body.addendumLinks || [];
        addendumLinks = oldAddendumLinks.map((url: string) => ({ url }));
        originalContractUrlFromBody = body.originalContractUrl;
      }
      
      // Validate addendum links if provided
      if (addendumLinks.length > 0) {
        const invalidLinks = addendumLinks.filter(link => !validateAddendumUrl(link.url));
        if (invalidLinks.length > 0) {
          return NextResponse.json(
            { 
              error: 'Invalid addendum URL format',
              message: `The following links are invalid: ${invalidLinks.map(l => l.url).join(', ')}. Expected format: https://l1.prodbx.com/go/view/?...`
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
      
      // Fetch existing contract items if existingContractId is provided
      let existingItems: any[] = [];
      if (existingContractId) {
        try {
          const { db, schema } = await import('@/lib/db');
          const { convertDatabaseToStoredContract } = await import('@/lib/db/contractHelpers');
          const { eq } = await import('drizzle-orm');
          
          // Try to find contract by ID
          const order = await db
            .select()
            .from(schema.orders)
            .where(eq(schema.orders.id, existingContractId))
            .limit(1)
            .then(rows => rows[0]);
          
          if (order) {
            const orderItems = await db
              .select()
              .from(schema.orderItems)
              .where(eq(schema.orderItems.orderId, order.id));
            
            const customer = await db
              .select()
              .from(schema.customers)
              .where(eq(schema.customers.dbxCustomerId, order.customerId))
              .limit(1)
              .then(rows => rows[0]);
            
            if (customer) {
              const existingContract = convertDatabaseToStoredContract(customer, order, orderItems);
              existingItems = existingContract.items || [];
              console.log(`[API] Found existing contract with ${existingItems.length} items`);
            }
          }
        } catch (fetchError) {
          console.warn(`[API] Could not fetch existing contract: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
        }
      }
      
      // NEW FLOW: Check if we should parse original contract from EML table
      const emlOriginalSelected = selectedSections.some(
        s => s.source === 'eml-table' && s.type === 'original'
      );
      
      if (parseOriginalContractFromTable && emlOriginalSelected) {
        // Parse original contract from EML HTML table
        try {
          console.log('[API] Parsing original contract from EML HTML table');
          items = extractOrderItems(parsed.html);
          
          // Tag optional package items (post-process)
          const $ = load(parsed.html);
          const table = $('table.pos').first() || $('table').first();
          const rows = table.find('tr');
          let currentOptionalPackageNumber: number | undefined = undefined;
          
          // Map items to their positions in the HTML table
          rows.each((index, row) => {
            const $row = $(row);
            const rowText = $row.text();
            
            // Check if this row is an optional package marker
            const markerMatch = rowText.match(/-OPTIONAL\s+PACKAGE\s+(\d+)-/i);
            if (markerMatch) {
              currentOptionalPackageNumber = parseInt(markerMatch[1], 10);
              return; // Skip marker row
            }
            
            // Check if this row contains a line item
            const cells = $row.find('td');
            if (cells.length >= 3) {
              const descriptionCell = cells.eq(0);
              const qtyCell = cells.eq(1);
              const extendedCell = cells.eq(2);
              
              // Try to match this row to an extracted item
              const description = descriptionCell.text().trim();
              const qty = qtyCell.text().trim();
              const extended = extendedCell.text().trim();
              
              // Find matching item and tag it
              const matchingItemIndex = items.findIndex(item => {
                if (item.type !== 'item') return false;
                const itemDesc = (item.productService || '').trim();
                const itemQty = String(item.qty || '').trim();
                const itemExtended = String(item.amount || '').trim();
                
                // Match by description (most reliable)
                return itemDesc === description || 
                       (itemDesc && description && itemDesc.includes(description.substring(0, 20)));
              });
              
              if (matchingItemIndex >= 0 && currentOptionalPackageNumber !== undefined) {
                items[matchingItemIndex] = {
                  ...items[matchingItemIndex],
                  isOptional: true,
                  optionalPackageNumber: currentOptionalPackageNumber,
                };
              }
            }
          });
          
          // Filter items based on selected optional packages
          const selectedOptionalPackages = selectedSections
            .filter(s => s.source === 'eml-table' && s.type === 'optional-package')
            .map(s => s.number)
            .filter((n): n is number => n !== undefined);
          
          if (selectedOptionalPackages.length > 0) {
            // Include original contract items + selected optional package items
            items = items.filter(item =>
              !item.isOptional || 
              (item.isOptional && item.optionalPackageNumber && selectedOptionalPackages.includes(item.optionalPackageNumber))
            );
          } else {
            // Only include original contract items (exclude all optional packages)
            items = items.filter(item => !item.isOptional);
          }
          
          processingSummary.originalContract.status = 'success';
          processingSummary.summary.successful++;
          console.log(`[API] Successfully parsed original contract from EML table: ${items.length} items`);
        } catch (error) {
          processingSummary.originalContract.status = 'failed';
          processingSummary.originalContract.error = error instanceof Error ? error.message : 'Unknown error';
          processingSummary.summary.failed++;
          console.error('[API] Failed to parse from EML HTML table:', error);
          throw new Error(`Failed to parse from EML HTML table: ${processingSummary.originalContract.error}`);
        }
        
        // Process selected addendums and optional packages from links
        // (selectedSections will only contain link sections for addendums/optional packages)
        const linkSections = selectedSections.filter(s => s.source === 'link');
        
        // Build a map of selected addendum numbers per URL for filtering
        const selectedAddendumNumbersByUrl = new Map<string, Set<number>>();
        linkSections
          .filter(s => s.type === 'addendum' && s.url && s.number !== undefined)
          .forEach(s => {
            const url = s.url!;
            const number = s.number!;
            if (!selectedAddendumNumbersByUrl.has(url)) {
              selectedAddendumNumbersByUrl.set(url, new Set());
            }
            selectedAddendumNumbersByUrl.get(url)!.add(number);
          });
        
        // Get unique URLs to process
        const addendumUrls = Array.from(new Set(
          linkSections
            .filter(s => s.type === 'addendum' && s.url)
            .map(s => s.url!)
        ));
        
        if (addendumUrls.length > 0) {
          processingSummary.summary.totalLinks += addendumUrls.length;
          for (const url of addendumUrls) {
            try {
              const addendumResult = await fetchAndParseAddendums([url]);
              
              // Filter results to only include selected addendum numbers
              const selectedNumbers = selectedAddendumNumbersByUrl.get(url);
              let filteredResults: AddendumData[] = [];
              
              if (selectedNumbers && selectedNumbers.size > 0) {
                // Only include addendums whose numbers match selected sections
                filteredResults = addendumResult.filter(addendum => {
                  const addendumNum = parseInt(addendum.addendumNumber || '0', 10);
                  const isSelected = selectedNumbers.has(addendumNum);
                  console.log(`[API] Filtering addendum - URL: ${url}, parsed number: ${addendumNum}, selected numbers: [${Array.from(selectedNumbers).join(', ')}], isSelected: ${isSelected}`);
                  return isSelected;
                });
              } else {
                // If no specific numbers selected, include all (backward compatibility)
                console.log(`[API] No specific addendum numbers selected for URL ${url}, including all addendums`);
                filteredResults = addendumResult;
              }
              
              if (filteredResults.length > 0) {
                addendumData.push(...filteredResults);
                processingSummary.addendums.push({ url, status: 'success' });
                processingSummary.summary.successful++;
              } else {
                processingSummary.addendums.push({ url, status: 'failed', error: 'No matching addendums found' });
                processingSummary.summary.failed++;
                console.warn(`[API] No matching addendums found for URL ${url} (filtered out)`);
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              processingSummary.addendums.push({ url, status: 'failed', error: errorMessage });
              processingSummary.summary.failed++;
            }
          }
        }
        
        // Process optional packages from links
        const linkOptionalPackages = linkSections
          .filter(s => s.type === 'optional-package' && s.url && s.number)
          .map(s => ({ url: s.url!, number: s.number! }));
        
        if (linkOptionalPackages.length > 0) {
          processingSummary.summary.totalLinks += linkOptionalPackages.length;
          for (const pkgLink of linkOptionalPackages) {
            try {
              const pkgHTML = await fetchAddendumHTML(pkgLink.url);
              const contractId = `optional-package-${pkgLink.number}`;
              const pkgItems = parseOriginalContract(pkgHTML, contractId, pkgLink.url);
              const markedItems = pkgItems.map(item => ({
                ...item,
                isOptional: true,
                optionalPackageNumber: pkgLink.number,
              }));
              items.push(...markedItems);
              processingSummary.summary.successful++;
            } catch (error) {
              console.error(`[API] Failed to parse optional package ${pkgLink.number} from link:`, error);
              processingSummary.summary.failed++;
            }
          }
        }
      }
      // NEW FLOW: Process selected addendums only (reupload scenario - no original contract)
      // This handles when user selects only addendums without original contract
      else if (selectedSections.length > 0 && selectedSections.some(s => s.type === 'addendum' && s.source === 'link') && !originalContractUrlFromBody) {
        console.log('[API] Processing selected addendums only (reupload scenario)');
        
        // Process selected addendums and optional packages from links
        const linkSections = selectedSections.filter(s => s.source === 'link');
        
        // Build a map of selected addendum numbers per URL for filtering
        const selectedAddendumNumbersByUrl = new Map<string, Set<number>>();
        linkSections
          .filter(s => s.type === 'addendum' && s.url && s.number !== undefined)
          .forEach(s => {
            const url = s.url!;
            const number = s.number!;
            if (!selectedAddendumNumbersByUrl.has(url)) {
              selectedAddendumNumbersByUrl.set(url, new Set());
            }
            selectedAddendumNumbersByUrl.get(url)!.add(number);
          });
        
        // Get unique URLs to process
        const addendumUrls = Array.from(new Set(
          linkSections
            .filter(s => s.type === 'addendum' && s.url)
            .map(s => s.url!)
        ));
        
        if (addendumUrls.length > 0) {
          processingSummary.summary.totalLinks += addendumUrls.length;
          for (const url of addendumUrls) {
            try {
              const addendumResult = await fetchAndParseAddendums([url]);
              
              // Filter results to only include selected addendum numbers
              const selectedNumbers = selectedAddendumNumbersByUrl.get(url);
              let filteredResults: AddendumData[] = [];
              
              if (selectedNumbers && selectedNumbers.size > 0) {
                // Only include addendums whose numbers match selected sections
                filteredResults = addendumResult.filter(addendum => {
                  const addendumNum = parseInt(addendum.addendumNumber || '0', 10);
                  const isSelected = selectedNumbers.has(addendumNum);
                  console.log(`[API] Filtering addendum - URL: ${url}, parsed number: ${addendumNum}, selected numbers: [${Array.from(selectedNumbers).join(', ')}], isSelected: ${isSelected}`);
                  return isSelected;
                });
              } else {
                // If no specific numbers selected, include all (backward compatibility)
                console.log(`[API] No specific addendum numbers selected for URL ${url}, including all addendums`);
                filteredResults = addendumResult;
              }
              
              if (filteredResults.length > 0) {
                addendumData.push(...filteredResults);
                processingSummary.addendums.push({ url, status: 'success' });
                processingSummary.summary.successful++;
                console.log(`[API] Successfully processed ${filteredResults.length} selected addendum(s) from ${url}`);
              } else {
                processingSummary.addendums.push({ url, status: 'failed', error: 'No matching addendums found' });
                processingSummary.summary.failed++;
                console.warn(`[API] No matching addendums found for URL ${url} (filtered out)`);
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              processingSummary.addendums.push({ url, status: 'failed', error: errorMessage });
              processingSummary.summary.failed++;
              console.error(`[API] Failed to process addendum URL ${url}:`, errorMessage);
            }
          }
        }
        
        // Process optional packages from links if selected
        const linkOptionalPackages = linkSections
          .filter(s => s.type === 'optional-package' && s.url && s.number)
          .map(s => ({ url: s.url!, number: s.number! }));
        
        if (linkOptionalPackages.length > 0) {
          processingSummary.summary.totalLinks += linkOptionalPackages.length;
          for (const pkgLink of linkOptionalPackages) {
            try {
              const pkgHTML = await fetchAddendumHTML(pkgLink.url);
              const contractId = `optional-package-${pkgLink.number}`;
              const pkgItems = parseOriginalContract(pkgHTML, contractId, pkgLink.url);
              const markedItems = pkgItems.map(item => ({
                ...item,
                isOptional: true,
                optionalPackageNumber: pkgLink.number,
              }));
              items.push(...markedItems);
              processingSummary.summary.successful++;
            } catch (error) {
              console.error(`[API] Failed to parse optional package ${pkgLink.number} from link:`, error);
              processingSummary.summary.failed++;
            }
          }
        }
        
        // items array remains empty (will be merged with existing items later)
        console.log(`[API] Processed ${addendumData.length} selected addendum(s), items array: ${items.length} (will merge with existing)`);
      }
      // NEW FLOW: If originalContractUrl is provided in body, use it (from Step 2 selection)
      // Only process if includeOriginalContract is true
      else if (originalContractUrlFromBody && includeOriginalContract) {
        processingSummary.originalContract.url = originalContractUrlFromBody;
        console.log(`[API] Using provided Original Contract link: ${originalContractUrlFromBody}`);
        
        try {
          const originalContractHTML = await fetchAddendumHTML(originalContractUrlFromBody);
          const contractId = extractAddendumNumber(originalContractUrlFromBody);
          items = parseOriginalContract(originalContractHTML, contractId, originalContractUrlFromBody);
          processingSummary.originalContract.status = 'success';
          processingSummary.summary.successful++;
          processingSummary.summary.totalLinks++;
          console.log(`[API] Successfully processed Original Contract: ${items.length} items`);
        } catch (error) {
          processingSummary.originalContract.status = 'failed';
          processingSummary.originalContract.error = error instanceof Error ? error.message : 'Unknown error';
          processingSummary.summary.failed++;
          processingSummary.summary.totalLinks++;
          console.warn(`[API] Failed to process Original Contract: ${processingSummary.originalContract.error}`);
          // Fallback to email HTML
          try {
            items = extractOrderItems(parsed.html);
            console.log('[API] Falling back to email HTML for main contract items');
          } catch (emailError) {
            items = [];
          }
        }
        
        // NEW: Process Optional Packages (uses existing parsing function)
        if (optionalPackageLinks.length > 0) {
          processingSummary.summary.totalLinks += optionalPackageLinks.length;
          
          for (const pkgLink of optionalPackageLinks) {
            try {
              const pkgHTML = await fetchAddendumHTML(pkgLink.url);
              const contractId = `optional-package-${pkgLink.number}`;
              
              // Use existing parseOriginalContract function (it works for any contract HTML)
              // CRITICAL: This is the existing parsing function, called as-is
              const pkgItems = parseOriginalContract(pkgHTML, contractId, pkgLink.url);
              
              // NEW: Mark all items as optional (metadata addition, not parsing change)
              const markedItems = pkgItems.map(item => ({
                ...item, // Preserve all existing fields
                isOptional: true, // NEW: Add optional flag
                optionalPackageNumber: pkgLink.number, // NEW: Add package number
              }));
              
              // Add to items array
              items.push(...markedItems);
              
              processingSummary.summary.successful++;
            } catch (error) {
              console.error(`[API] Failed to parse optional package ${pkgLink.number}:`, error);
              processingSummary.summary.failed++;
              // Continue with other packages (graceful degradation)
            }
          }
        }
        
        // Process provided addendum links with filtering by selected addendum numbers
        if (addendumLinks.length > 0) {
          processingSummary.summary.totalLinks += addendumLinks.length;
          
          // Build a map of selected addendum numbers per URL for filtering
          const selectedAddendumNumbersByUrl = new Map<string, Set<number>>();
          addendumLinks.forEach(link => {
            if (link.number !== undefined) {
              if (!selectedAddendumNumbersByUrl.has(link.url)) {
                selectedAddendumNumbersByUrl.set(link.url, new Set());
              }
              selectedAddendumNumbersByUrl.get(link.url)!.add(link.number);
            }
          });
          
          // Get unique URLs to process (deduplicate)
          const uniqueUrls = Array.from(new Set(addendumLinks.map(link => link.url)));
          
          for (const url of uniqueUrls) {
            try {
              const addendumResult = await fetchAndParseAddendums([url]);
              
              // Filter results to only include selected addendum numbers
              const selectedNumbers = selectedAddendumNumbersByUrl.get(url);
              let filteredResults: AddendumData[] = [];
              
              if (selectedNumbers && selectedNumbers.size > 0) {
                // Only include addendums whose numbers match selected sections
                filteredResults = addendumResult.filter(addendum => {
                  const addendumNum = parseInt(addendum.addendumNumber || '0', 10);
                  const isSelected = selectedNumbers.has(addendumNum);
                  console.log(`[API] Filtering addendum - URL: ${url}, parsed number: ${addendumNum}, selected numbers: [${Array.from(selectedNumbers).join(', ')}], isSelected: ${isSelected}`);
                  return isSelected;
                });
              } else {
                // If no specific numbers selected, include all (backward compatibility)
                console.log(`[API] No specific addendum numbers selected for URL ${url}, including all addendums`);
                filteredResults = addendumResult;
              }
              
              if (filteredResults.length > 0) {
                addendumData.push(...filteredResults);
                processingSummary.addendums.push({ url, status: 'success' });
                processingSummary.summary.successful++;
              } else {
                processingSummary.addendums.push({ url, status: 'failed', error: 'No matching addendums found' });
                processingSummary.summary.failed++;
                console.warn(`[API] No matching addendums found for URL ${url} (filtered out)`);
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              processingSummary.addendums.push({ url, status: 'failed', error: errorMessage });
              processingSummary.summary.failed++;
            }
          }
        }
      }
      // OLD FLOW: Auto-detect links if addAddendum checkbox is unchecked (backward compatibility)
      // Only process original contract if includeOriginalContract is true
      else if (!addAddendum) {
        console.log('[API] Auto-detecting contract links from email...');
        const extractedLinks = extractContractLinks(parsed);
        console.log(`[API] Extracted links - Original Contract: ${extractedLinks.originalContractUrl || 'not found'}, Addendums: ${extractedLinks.addendumUrls.length}`);
        
        // Process Original Contract if found and includeOriginalContract is true
        if (extractedLinks.originalContractUrl && includeOriginalContract) {
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
        // Manual addendum links provided (existing behavior - backward compatibility)
        // Only extract items from email HTML if includeOriginalContract is true
        if (includeOriginalContract) {
        items = extractOrderItems(parsed.html);
        } else {
          items = [];
          console.log('[API] Skipping original contract processing from email HTML (includeOriginalContract: false)');
        }
        
        // NEW: Process Optional Packages (uses existing parsing function)
        if (optionalPackageLinks.length > 0) {
          processingSummary.summary.totalLinks += optionalPackageLinks.length;
          
          for (const pkgLink of optionalPackageLinks) {
            try {
              const pkgHTML = await fetchAddendumHTML(pkgLink.url);
              const contractId = `optional-package-${pkgLink.number}`;
              
              // Use existing parseOriginalContract function (it works for any contract HTML)
              // CRITICAL: This is the existing parsing function, called as-is
              const pkgItems = parseOriginalContract(pkgHTML, contractId, pkgLink.url);
              
              // NEW: Mark all items as optional (metadata addition, not parsing change)
              const markedItems = pkgItems.map(item => ({
                ...item, // Preserve all existing fields
                isOptional: true, // NEW: Add optional flag
                optionalPackageNumber: pkgLink.number, // NEW: Add package number
              }));
              
              // Add to items array
              items.push(...markedItems);
              
              processingSummary.summary.successful++;
            } catch (error) {
              console.error(`[API] Failed to parse optional package ${pkgLink.number}:`, error);
              processingSummary.summary.failed++;
              // Continue with other packages (graceful degradation)
            }
          }
        }
        
        if (addendumLinks.length > 0) {
          console.log(`[API] Processing ${addendumLinks.length} manually entered addendum link(s)...`);
          processingSummary.summary.totalLinks = addendumLinks.length;
          
          // Build a map of selected addendum numbers per URL for filtering
          const selectedAddendumNumbersByUrl = new Map<string, Set<number>>();
          addendumLinks.forEach(link => {
            if (link.number !== undefined) {
              if (!selectedAddendumNumbersByUrl.has(link.url)) {
                selectedAddendumNumbersByUrl.set(link.url, new Set());
              }
              selectedAddendumNumbersByUrl.get(link.url)!.add(link.number);
            }
          });
          
          // Get unique URLs to process (deduplicate)
          const uniqueUrls = Array.from(new Set(addendumLinks.map(link => link.url)));
          
          // Process each addendum and track status
          for (const url of uniqueUrls) {
            try {
              const addendumResult = await fetchAndParseAddendums([url]);
              
              // Filter results to only include selected addendum numbers
              const selectedNumbers = selectedAddendumNumbersByUrl.get(url);
              let filteredResults: AddendumData[] = [];
              
              if (selectedNumbers && selectedNumbers.size > 0) {
                // Only include addendums whose numbers match selected sections
                filteredResults = addendumResult.filter(addendum => {
                  const addendumNum = parseInt(addendum.addendumNumber || '0', 10);
                  const isSelected = selectedNumbers.has(addendumNum);
                  console.log(`[API] Filtering addendum - URL: ${url}, parsed number: ${addendumNum}, selected numbers: [${Array.from(selectedNumbers).join(', ')}], isSelected: ${isSelected}`);
                  return isSelected;
                });
              } else {
                // If no specific numbers selected, include all (backward compatibility)
                console.log(`[API] No specific addendum numbers selected for URL ${url}, including all addendums`);
                filteredResults = addendumResult;
              }
              
              if (filteredResults.length > 0) {
                addendumData.push(...filteredResults);
                processingSummary.addendums.push({ url, status: 'success' });
                processingSummary.summary.successful++;
                console.log(`[API] Successfully processed ${filteredResults.length} selected addendum(s) from ${url}`);
              } else {
                processingSummary.addendums.push({ url, status: 'failed', error: 'No matching addendums found' });
                processingSummary.summary.failed++;
                console.warn(`[API] No matching addendums found for URL ${url} (filtered out)`);
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
      
      // Merge with existing contract items if existingContractId is provided and only addendums were processed
      // CRITICAL: This preserves ALL existing item data including progress updates, invoice links, and any user modifications
      // We only APPEND new addendum items - we never modify or overwrite existing items
      // Merge condition: If we have existing contract, existing items, and new addendums, merge them
      // Removed !includeOriginalContract requirement - merge should happen for reupload even if items is empty
      if (existingContractId && existingItems.length > 0 && addendumData.length > 0) {
        console.log(`[API] Merging ${addendumData.length} addendum(s) with ${existingItems.length} existing items`);
        console.log(`[API] CRITICAL: Preserving all existing item properties (progress fields, invoice links, etc.)`);
        // Combine: existing items + 1 blank row + new addendum items
        // Using map with spread creates deep copy of each item to ensure no accidental modifications
        const mergedItems: any[] = existingItems.map(item => ({ ...item })); // Deep copy each item to ensure no accidental modifications
        
        // Add exactly 1 blank row before new addendums
        mergedItems.push({
          type: 'item',
          productService: '',
          qty: '',
          rate: '',
          amount: '',
          columnBLabel: 'Initial',
          isBlankRow: true,
        });
        
        // Add addendum items
        addendumData.forEach((addendum: AddendumData) => {
          const addendumNum = addendum.addendumNumber;
          const urlId = addendum.urlId || addendum.addendumNumber;
          const headerText = `Addendum #${addendumNum} (${urlId})`;
          
          mergedItems.push({
            type: 'maincategory',
            productService: headerText,
            qty: '',
            rate: '',
            amount: '',
            columnBLabel: 'Addendum',
            isAddendumHeader: true,
            addendumNumber: addendumNum,
            addendumUrlId: urlId,
          });
          
          addendum.items.forEach((item: any) => {
            mergedItems.push({
              ...item,
              columnBLabel: 'Addendum',
            });
          });
        });
        
        // Replace items with merged items
        items = mergedItems as any;
        console.log(`[API] Merged items total: ${items.length}`);
      } else if (existingContractId && existingItems.length > 0 && items.length === 0 && addendumData.length === 0) {
        // Safety check: If we have existing items but no new data, preserve existing items
        console.warn(`[API] No new addendums to add, but existing items found. Preserving existing items.`);
        items = existingItems.map(item => ({ ...item }));
      }
      
      // Apply filtering based on category inclusion flags
      const filteredItems = filterItems(items, includeMainCategories, includeSubcategories);
      const filteredAddendumData = addendumData.map(addendum => ({
        ...addendum,
        items: filterItems(addendum.items, includeMainCategories, includeSubcategories),
      }));
      
      // Sort addendums by number in ascending order
      const sortedAddendumData = [...filteredAddendumData].sort((a, b) => {
        const numA = parseInt(a.addendumNumber || '0', 10);
        const numB = parseInt(b.addendumNumber || '0', 10);
        return numA - numB; // Ascending order
      });
      
      console.log(`[API] Filtered items: ${filteredItems.length} (from ${items.length} original)`);
      console.log(`[API] Filtered addendums: ${sortedAddendumData.length} addendums with filtered items`);
      
      // Validate order items total matches Order Grand Total
      const orderItemsValidation = validateOrderItemsTotal(filteredItems, location.orderGrandTotal);
      if (!orderItemsValidation.isValid) {
        console.warn('[API] Order items total validation failed:', orderItemsValidation.message);
      }

      // Add contractDate to location object if orderDate exists
      const locationWithContractDate = {
        ...location,
        contractDate: location.orderDate ? normalizeToMmddyyyy(location.orderDate) : null,
      };

      // Final safety check: Prevent overwriting existing contract with empty items during reupload
      if (existingContractId && filteredItems.length === 0 && existingItems.length > 0 && addendumData.length === 0) {
        console.warn(`[API] SAFETY CHECK: Would overwrite existing contract with empty items. Preserving existing items instead.`);
        // Use existing items instead of empty array
        const existingFilteredItems = filterItems(existingItems, includeMainCategories, includeSubcategories);
        return NextResponse.json({
          success: true,
          data: {
            location: locationWithContractDate,
            items: existingFilteredItems,
            addendums: [],
            isLocationParsed,
            orderItemsValidation,
          },
          processingSummary,
        });
      }

      // If returnData is true, return JSON data instead of Excel file
      if (returnData) {
        return NextResponse.json({
          success: true,
          data: {
            location: locationWithContractDate,
            items: filteredItems,
            addendums: sortedAddendumData,
            isLocationParsed, // Include validation status
            orderItemsValidation, // Include order items validation
          },
          processingSummary,
        });
      }
      
      // Generate spreadsheet with filtered data and deleteExtraRows option
      const spreadsheetBuffer = await generateSpreadsheet(filteredItems, location, sortedAddendumData, deleteExtraRows);
      
      // Generate filename based on location data
      // Format: "{Client Initial Last Name} - #{DBX Customer ID} - {Address}.xlsx"
      const filename = generateSpreadsheetFilename(location);
      
      // Debug: Log generated filename
      console.log('[API] Generated filename:', filename);
      
      // Upload to Vercel Blob for Google Sheets import (temporary storage)
      let blobUrl: string | null = null;
      try {
        // Sanitize blob filename for URL compatibility (replace spaces with hyphens, remove #)
        // Download filename stays clean: "N. Robinson - #10472 - 19 Augusta.xlsx"
        // Blob filename is URL-friendly: "N.-Robinson-10472-19-Augusta-{timestamp}.xlsx"
        const filenameWithoutExt = filename.replace(/\.xlsx$/, '');
        // Replace " - " separator with single hyphen, replace remaining spaces with hyphens, remove # symbol
        const sanitizedBlobName = filenameWithoutExt
          .replace(/\s+-\s+/g, '-')  // Replace " - " with single hyphen
          .replace(/\s+/g, '-')      // Replace remaining spaces with hyphens
          .replace(/#/g, '')         // Remove # symbol
          .replace(/--+/g, '-')      // Replace multiple hyphens with single hyphen
          .replace(/^-|-$/g, '');    // Remove leading/trailing hyphens
        const uniqueBlobFilename = `${sanitizedBlobName}-${Date.now()}.xlsx`;
        
        const blob = await put(uniqueBlobFilename, spreadsheetBuffer, {
          access: 'public',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        blobUrl = blob.url;
        console.log('[API] Uploaded to Vercel Blob:', blobUrl);
      } catch (blobError) {
        console.error('[API] Failed to upload to Vercel Blob:', blobError);
        // Continue with download even if blob upload fails
      }
      
      // Encode filename for Content-Disposition header (RFC 5987)
      // Use both filename (fallback) and filename* (UTF-8 encoded) for maximum browser compatibility
      const encodedFilename = encodeURIComponent(filename);
      const contentDisposition = `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`;
      
      // Prepare response headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': contentDisposition,
        'Content-Length': spreadsheetBuffer.length.toString(),
        'X-Content-Type-Options': 'nosniff',
        'X-Processing-Summary': JSON.stringify(processingSummary),
      };
      
      // Add blob URL to headers if available
      if (blobUrl) {
        headers['X-Blob-Url'] = blobUrl;
      }
      
      // Return file as response with processing summary and blob URL in headers
      return new NextResponse(spreadsheetBuffer as any, {
        status: 200,
        headers,
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

