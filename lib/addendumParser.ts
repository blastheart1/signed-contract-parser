import { load } from 'cheerio';
import { OrderItem } from './tableExtractor';

/**
 * Addendum data structure
 */
export interface AddendumData {
  addendumNumber: string; // The actual addendum number from the page (e.g., "7")
  items: OrderItem[];
  url: string;
  urlId?: string; // The ID from the URL (e.g., "35587") - optional for backwards compatibility
}

/**
 * Extract addendum number from URL
 * Example: https://l1.prodbx.com/go/view/?35587.426.20251112100816 -> "35587"
 * @param url - Addendum URL
 * @returns Addendum number
 */
export function extractAddendumNumber(url: string): string {
  try {
    // Extract the query parameter value after "?"
    const urlObj = new URL(url);
    const queryParam = urlObj.search.substring(1); // Remove the "?" character
    
    // Split by "." and take the first part (addendum number)
    const parts = queryParam.split('.');
    if (parts.length > 0 && parts[0]) {
      return parts[0].trim();
    }
    
    // Fallback: try to extract from URL directly
    const match = url.match(/[?&](\d+)\./);
    if (match && match[1]) {
      return match[1];
    }
    
    throw new Error(`Could not extract addendum number from URL: ${url}`);
  } catch (error) {
    throw new Error(`Invalid URL format: ${url}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate addendum URL format
 * @param url - URL to validate
 * @returns true if URL is valid
 */
export function validateAddendumUrl(url: string): boolean {
  try {
    // Accept both l1.prodbx.com and login.prodbx.com
    const urlPattern = /^https?:\/\/(l1|login)\.prodbx\.com\/go\/view\/\?/i;
    return urlPattern.test(url.trim());
  } catch {
    return false;
  }
}

/**
 * Fetch HTML content from addendum URL
 * @param url - Addendum URL
 * @returns HTML content as string
 */
export async function fetchAddendumHTML(url: string): Promise<string> {
  try {
    // Validate URL format
    if (!validateAddendumUrl(url)) {
      throw new Error(`Invalid addendum URL format: ${url}. Expected format: https://l1.prodbx.com/go/view/?...`);
    }
    
    // Fetch HTML content (Node.js 18+ has native fetch)
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      // Add timeout (30 seconds)
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch addendum URL: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    
    if (!html || html.trim().length === 0) {
      throw new Error('Empty HTML content received from addendum URL');
    }
    
    return html;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Timeout while fetching addendum URL: ${url}`);
    }
    throw new Error(`Failed to fetch addendum HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Clean HTML entities and formatting from text
 * @param text - Text with HTML entities
 * @returns Cleaned text
 */
function cleanText(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\*\*/g, '') // Remove double asterisks (markdown bold)
    .replace(/\*/g, '') // Remove single asterisks
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract numeric quantity from quantity string
 * @param qtyStr - Quantity string like "162 SF", "1 EA", "50 LF"
 * @returns Numeric quantity
 */
function extractQuantity(qtyStr: string): number {
  if (!qtyStr) return 1;
  
  // Remove non-breaking spaces and extract number
  const cleaned = qtyStr.replace(/\u00A0/g, ' ').trim();
  const match = cleaned.match(/^(\d+(?:\.\d+)?)/);
  
  if (match) {
    return parseFloat(match[1]);
  }
  
  return 1;
}

/**
 * Extract numeric value from amount/rate string
 * @param amountStr - Amount string like "13,692.20", "$1,234.56"
 * @returns Numeric value
 */
function extractAmount(amountStr: string): number {
  if (!amountStr) return 0;
  
  // Remove currency symbols, commas, and whitespace
  // Handle negative amounts (may have minus sign before or after currency symbol)
  const cleaned = amountStr.replace(/[$,\s]/g, '').trim();
  
  // Try to match negative numbers (with or without minus sign at start)
  // Also handle cases where minus might be embedded like "-2,000.00"
  const match = cleaned.match(/^-?\d+(?:\.\d+)?/);
  
  if (match && match[0]) {
    const value = parseFloat(match[0]);
    // If the original string contains negative indicators and we got a positive value, make it negative
    if (value > 0 && (amountStr.includes('\-') || cleaned.startsWith('-'))) {
      return -value;
    }
    return value;
  }
  
  return 0;
}

/**
 * Parse addendum HTML and extract order items
 * Similar to extractOrderItems but specifically for addendum pages
 * @param html - HTML content from addendum URL
 * @param addendumNumber - Addendum number from URL (for metadata)
 * @param url - Original URL (for error reporting)
 * @returns AddendumData with items array
 */
export function parseAddendum(html: string, addendumNumber: string, url: string): AddendumData {
  try {
    const $ = load(html);
    const items: OrderItem[] = [];
    
    // Extract the actual addendum number from the page (e.g., "Addendum #: 7")
    // This is different from the URL ID (e.g., 35587)
    let pageAddendumNumber: string | null = null;
    const pageText = $.text();
    const addendumMatch = pageText.match(/Addendum\s*#\s*:?\s*(\d+)/i);
    if (addendumMatch && addendumMatch[1]) {
      pageAddendumNumber = addendumMatch[1].trim();
      console.log(`[Addendum Parser] Found addendum number on page: ${pageAddendumNumber} (URL ID: ${addendumNumber})`);
    }
    
    // Use page addendum number if found, otherwise fall back to URL ID
    const displayAddendumNumber = pageAddendumNumber || addendumNumber;
    
    // Find the table with class "pos" (same as email parser)
    const table = $('table.pos');
    
    if (table.length === 0) {
      // Try alternative table selectors
      const altTable = $('table').first();
      if (altTable.length === 0) {
        throw new Error('Order Items Table not found in addendum HTML. Expected table with class "pos"');
      }
      console.warn(`[Addendum Parser] Warning: Table with class "pos" not found, using first table instead for addendum ${addendumNumber}`);
    }
    
    // Use the table found (pos table or first table)
    const targetTable = table.length > 0 ? table : $('table').first();
    
    // Find all rows in the table
    const rows = targetTable.find('tr');
    
    if (rows.length === 0) {
      throw new Error('No rows found in addendum table');
    }
    
    let currentMainCategory: string | null = null;
    let currentSubCategory: string | null = null;
    
    // Process all rows (similar to email parser)
    // Skip header rows and empty rows automatically
    rows.each((index, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      
      // Skip empty rows
      if (cells.length === 0) {
        return;
      }
      
      // Skip header row (first row with "Description", "Qty", "Extended")
      const rowText = $row.text();
      const rowTextLower = rowText.toLowerCase();
      if (rowTextLower.includes('description') && rowTextLower.includes('qty') && rowTextLower.includes('extended')) {
        return;
      }
      
      // Check if this is a sub-category header (class "ssg_title" or similar)
      const firstCell = cells.first();
      const isSubCategory = $row.hasClass('ssg_title') || 
                           firstCell.hasClass('ssg_title') ||
                           firstCell.attr('class')?.includes('ssg_title') ||
                           $row.hasClass('subcategory') ||
                           firstCell.attr('class')?.includes('subcategory');
      
      if (isSubCategory) {
        const categoryName = cleanText(firstCell.text());
        if (categoryName && categoryName.trim().length > 0) {
          currentSubCategory = categoryName;
          items.push({
            type: 'subcategory',
            productService: categoryName,
            qty: '',
            rate: '',
            amount: '',
            mainCategory: currentMainCategory,
            subCategory: categoryName,
          });
        }
        return;
      }
      
      // Check if this is a main category (bold text, larger font, has qty and extended)
      // Also check for category code patterns like "0100 Calimingo", "0020 Calimingo", etc.
      if (cells.length >= 3) {
        const firstCellText = firstCell.html() || '';
        const categoryText = cleanText(firstCell.text());
        
        // Check for category code pattern (e.g., "0100 Calimingo - Concrete", "0020 Calimingo - Pools")
        // Pattern: 4 digits followed by optional whitespace and "Calimingo"
        // Also handle cases where there might be no space or multiple spaces
        const categoryCodePattern = /^\s*\d{4}\s+Calimingo/i;
        const hasCategoryCode = categoryCodePattern.test(categoryText.trim());
        
        // Check for bold formatting
        const isBold = firstCellText.includes('font-weight: bold') ||
                      firstCellText.includes('font-size: 14px') ||
                      firstCell.find('span[style*="font-weight: bold"]').length > 0 ||
                      firstCell.find('span[style*="font-size: 14px"]').length > 0 ||
                      firstCell.find('strong').length > 0 ||
                      firstCell.find('b').length > 0;
        
        // Check if it has a quantity and extended amount (main categories do)
        const qtyCell = cells.eq(1);
        const extendedCell = cells.eq(2);
        const hasQtyAndExtended = qtyCell.text().trim() && extendedCell.text().trim();
        
        // Skip if it matches category code pattern AND has qty/extended (main category row)
        // OR if it's bold and has qty/extended
        if ((hasCategoryCode && hasQtyAndExtended) || (isBold && hasQtyAndExtended)) {
          if (categoryText && categoryText.trim().length > 0) {
            currentMainCategory = categoryText;
            // Main categories are skipped in addendum (same as email parser)
            // But we track them for context
            console.log(`[Addendum Parser] Skipping main category row: "${categoryText}"`);
            // Skip this row - don't process as line item
            return;
          }
        }
      }
      
      // Check if this is a regular line item (has description, qty, and extended)
      // Only process if it's not a main category or subcategory
      if (cells.length >= 3) {
        const descriptionCell = cells.eq(0);
        const qtyCell = cells.eq(1);
        const extendedCell = cells.eq(2);
        
        // Extract text properly - similar to email parser
        // Remove HTML formatting tags but keep their text content
        const cellHtml = descriptionCell.html() || '';
        const plainText = cellHtml
          .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '$1')
          .replace(/<em[^>]*>(.*?)<\/em>/gi, '$1')
          .replace(/<b[^>]*>(.*?)<\/b>/gi, '$1')
          .replace(/<i[^>]*>(.*?)<\/i>/gi, '$1')
          .replace(/<br\s*\/?>/gi, ' ') // Replace <br> with space
          .replace(/<\/?[^>]+(>|$)/g, ' '); // Remove any remaining HTML tags
        const description = cleanText(plainText);
        
        const qtyText = cleanText(qtyCell.text());
        const extendedText = cleanText(extendedCell.text());
        
        // Skip if description is empty
        if (!description || description.trim().length === 0) {
          return;
        }
        
        // Skip header rows that might have been missed
        if (description.toLowerCase().includes('description') && 
            qtyText.toLowerCase().includes('qty')) {
          return;
        }
        
        // Skip subtotal/tax/grand total rows (similar to email parser)
        if (description.toLowerCase().includes('subtotal') ||
            description.toLowerCase().includes('tax') ||
            description.toLowerCase().includes('grand total') ||
            description.toLowerCase().includes('current balance')) {
          return;
        }
        
        // Skip main category rows that might have been missed by the earlier check
        // Check for category code pattern (e.g., "0100 Calimingo - Concrete")
        // These are redundant category headers that shouldn't be included as line items
        // Check BOTH the category code pattern AND if it has qty/extended (main categories have both)
        // Also handle leading/trailing whitespace in description
        const categoryCodePattern = /^\s*\d{4}\s+Calimingo/i;
        const trimmedDescription = description.trim();
        const hasQtyAndExtendedInLineItem = qtyText.trim() && extendedText.trim();
        
        // Skip if it matches category code pattern AND has qty/extended
        // This ensures we only skip actual main category rows, not category names that might appear in descriptions
        if (categoryCodePattern.test(trimmedDescription) && hasQtyAndExtendedInLineItem) {
          // This looks like a main category row - skip it
          console.log(`[Addendum Parser] Skipping main category line item: "${trimmedDescription.substring(0, 50)}..." (Qty: ${qtyText}, Extended: ${extendedText})`);
          // Track it as main category for context, but don't add as item
          currentMainCategory = trimmedDescription;
          return;
        }
        
        // Extract values
        const qty = extractQuantity(qtyText);
        const extended = extractAmount(extendedText);
        
        // Only add if we have meaningful data (extended can be negative for returned items)
        // Allow negative amounts for returns/credits in addendums
        if (description && description.trim().length > 0 && extended !== 0) {
          // For addendums, we don't have a "rate" field - only qty and extended
          // Set rate to empty string
          items.push({
            type: 'item',
            productService: description,
            qty: qty,
            rate: '', // No rate for addendums
            amount: extended,
            mainCategory: currentMainCategory,
            subCategory: currentSubCategory,
          });
        }
      }
    });
    
    if (items.length === 0) {
      throw new Error(`No order items found in addendum ${addendumNumber}. Please verify the HTML structure.`);
    }
    
    console.log(`[Addendum Parser] Successfully parsed addendum ${displayAddendumNumber}: ${items.length} items found`);
    
    return {
      addendumNumber: displayAddendumNumber, // Use page addendum number if found
      items,
      url,
      // Store URL ID separately for display purposes
      urlId: addendumNumber, // The ID from URL (e.g., 35587)
    };
  } catch (error) {
    throw new Error(`Failed to parse addendum ${addendumNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse Original Contract page (similar to addendum but includes main categories)
 * @param html - HTML content from Original Contract URL
 * @param contractId - Contract ID from URL
 * @param url - Original URL
 * @returns Array of OrderItems (includes main categories, subcategories, and line items)
 */
export function parseOriginalContract(html: string, contractId: string, url: string): OrderItem[] {
  try {
    const $ = load(html);
    const items: OrderItem[] = [];
    
    // Find the table with class "pos" (same as addendum parser)
    const table = $('table.pos');
    
    if (table.length === 0) {
      // Try alternative table selectors
      const altTable = $('table').first();
      if (altTable.length === 0) {
        throw new Error('Order Items Table not found in Original Contract HTML. Expected table with class "pos"');
      }
      console.warn(`[Original Contract Parser] Warning: Table with class "pos" not found, using first table instead`);
    }
    
    // Use the table found (pos table or first table)
    const targetTable = table.length > 0 ? table : $('table').first();
    
    // Find all rows in the table
    const rows = targetTable.find('tr');
    
    if (rows.length === 0) {
      throw new Error('No rows found in Original Contract table');
    }
    
    let currentMainCategory: string | null = null;
    let currentSubCategory: string | null = null;
    
    // NEW: Track optional package state
    // When we encounter "-OPTIONAL PACKAGE X-" marker, mark subsequent items
    let currentOptionalPackageNumber: number | undefined = undefined;
    const pageText = $.text();
    
      // Process all rows
    rows.each((index, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      
      // Skip empty rows
      if (cells.length === 0) {
        return;
      }
      
      // NEW: Check if this row contains an optional package marker
      const rowText = $row.text();
      const optionalPackageMatch = rowText.match(/-OPTIONAL\s+PACKAGE\s+(\d+)-/i);
      if (optionalPackageMatch && optionalPackageMatch[1]) {
        const packageNumber = parseInt(optionalPackageMatch[1], 10);
        if (!isNaN(packageNumber) && packageNumber > 0) {
          currentOptionalPackageNumber = packageNumber;
          console.log(`[Original Contract Parser] Detected Optional Package ${packageNumber}`);
        }
      }
      
      // Also check if we've passed the optional package section (reset if we see "PACKAGE TOTAL")
      if (rowText.includes('PACKAGE TOTAL')) {
        // Keep the current package number until we see a new one or the section ends
        // Don't reset here - let it continue marking items until we see a new package or contract section
      }
      
      // Skip header row (first row with "Description", "Qty", "Extended")
      const rowTextLower = rowText.toLowerCase();
      if (rowTextLower.includes('description') && rowTextLower.includes('qty') && rowTextLower.includes('extended')) {
        return;
      }
      
      // Check if this is a sub-category header
      // Original Contract structure: row with 2 cells, first cell empty, second cell has border-top and contains <strong> with subcategory name
      const firstCell = cells.first();
      let isSubCategory = false;
      let subCategoryName = '';
      
      // Check for Original Contract subcategory pattern (2 cells, second cell has border-top style and strong tag)
      if (cells.length === 2) {
        const firstCellText = cleanText(firstCell.text());
        const secondCell = cells.eq(1);
        const secondCellStyle = secondCell.attr('style') || '';
        const secondCellHtml = secondCell.html() || '';
        
        // Check if first cell is empty (after cleaning, &nbsp; becomes space, so just check for empty/whitespace)
        // and second cell has the subcategory pattern
        if ((!firstCellText || firstCellText.trim() === '') &&
            secondCellStyle.includes('border-top:solid 1px #BBB') &&
            secondCellStyle.includes('letter-spacing:2px')) {
          // Extract subcategory name from <strong> tag inside the div
          const strongTag = secondCell.find('strong');
          if (strongTag.length > 0) {
            subCategoryName = cleanText(strongTag.text());
            if (subCategoryName && subCategoryName.trim().length > 0) {
              isSubCategory = true;
            }
          }
        }
      }
      
      // Also check for addendum-style subcategory (class "ssg_title" or similar)
      if (!isSubCategory) {
        isSubCategory = !!($row.hasClass('ssg_title') || 
                       firstCell.hasClass('ssg_title') ||
                       firstCell.attr('class')?.includes('ssg_title') ||
                       $row.hasClass('subcategory') ||
                       firstCell.attr('class')?.includes('subcategory'));
        
        if (isSubCategory) {
          subCategoryName = cleanText(firstCell.text());
        }
      }
      
      if (isSubCategory && subCategoryName && subCategoryName.trim().length > 0) {
        currentSubCategory = subCategoryName;
        items.push({
          type: 'subcategory',
          productService: subCategoryName,
          qty: '',
          rate: '',
          amount: '',
          mainCategory: currentMainCategory,
          subCategory: subCategoryName,
          // NEW: Mark as optional if we're in an optional package section
          ...(currentOptionalPackageNumber ? {
            isOptional: true,
            optionalPackageNumber: currentOptionalPackageNumber,
          } : {}),
        });
        console.log(`[Original Contract Parser] Added subcategory: "${subCategoryName}"${currentOptionalPackageNumber ? ` (Optional Package ${currentOptionalPackageNumber})` : ''}`);
        return;
      }
      
      // Check if this is a main category (bold text, larger font, has qty and extended)
      // Also check for category code patterns like "0100 Calimingo", "0020 Calimingo", etc.
      if (cells.length >= 3) {
        const firstCellText = firstCell.html() || '';
        const categoryText = cleanText(firstCell.text());
        
        // Check for category code pattern (e.g., "0100 Calimingo - Concrete", "0020 Calimingo - Pools")
        const categoryCodePattern = /^\s*\d{4}\s+Calimingo/i;
        const hasCategoryCode = categoryCodePattern.test(categoryText.trim());
        
        // Check for bold formatting
        const isBold = firstCellText.includes('font-weight: bold') ||
                      firstCellText.includes('font-size: 14px') ||
                      firstCell.find('span[style*="font-weight: bold"]').length > 0 ||
                      firstCell.find('span[style*="font-size: 14px"]').length > 0 ||
                      firstCell.find('strong').length > 0 ||
                      firstCell.find('b').length > 0;
        
        // Check if it has a quantity and extended amount (main categories do)
        const qtyCell = cells.eq(1);
        const extendedCell = cells.eq(2);
        const hasQtyAndExtended = qtyCell.text().trim() && extendedCell.text().trim();
        
        // Include main category if it matches category code pattern AND has qty/extended
        // OR if it's bold and has qty/extended
        if ((hasCategoryCode && hasQtyAndExtended) || (isBold && hasQtyAndExtended)) {
          if (categoryText && categoryText.trim().length > 0) {
            // Build full category name with colon at the end (like email parser)
            let fullCategoryName = categoryText.trim();
            // Remove trailing colon if present, then add it
            fullCategoryName = fullCategoryName.replace(/:\s*$/, '').trim();
            fullCategoryName = `${fullCategoryName}:`;
            
            currentMainCategory = fullCategoryName;
            currentSubCategory = null; // Reset sub-category when new main category starts
            
            // Extract qty and amount for main category
            const qtyText = cleanText(qtyCell.text());
            const extendedText = cleanText(extendedCell.text());
            const qty = extractQuantity(qtyText);
            const extended = extractAmount(extendedText);
            
            items.push({
              type: 'maincategory',
              productService: fullCategoryName,
              qty: qty,
              rate: '', // Main categories don't have rate in ProDBX pages
              amount: extended,
              mainCategory: fullCategoryName,
              subCategory: null,
              // NEW: Mark as optional if we're in an optional package section
              ...(currentOptionalPackageNumber ? {
                isOptional: true,
                optionalPackageNumber: currentOptionalPackageNumber,
              } : {}),
            });
            console.log(`[Original Contract Parser] Added main category: "${fullCategoryName}"${currentOptionalPackageNumber ? ` (Optional Package ${currentOptionalPackageNumber})` : ''}`);
            return;
          }
        }
      }
      
      // Check if this is a regular line item (has description, qty, and extended)
      // Only process if it's not a main category or subcategory
      if (cells.length >= 3) {
        const descriptionCell = cells.eq(0);
        const qtyCell = cells.eq(1);
        const extendedCell = cells.eq(2);
        
        // Extract text properly
        const cellHtml = descriptionCell.html() || '';
        const plainText = cellHtml
          .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '$1')
          .replace(/<em[^>]*>(.*?)<\/em>/gi, '$1')
          .replace(/<b[^>]*>(.*?)<\/b>/gi, '$1')
          .replace(/<i[^>]*>(.*?)<\/i>/gi, '$1')
          .replace(/<br\s*\/?>/gi, ' ')
          .replace(/<\/?[^>]+(>|$)/g, ' ');
        const description = cleanText(plainText);
        
        const qtyText = cleanText(qtyCell.text());
        const extendedText = cleanText(extendedCell.text());
        
        // Skip if description is empty
        if (!description || description.trim().length === 0) {
          return;
        }
        
        // Skip header rows that might have been missed
        if (description.toLowerCase().includes('description') && 
            qtyText.toLowerCase().includes('qty')) {
          return;
        }
        
        // Skip subtotal/tax/grand total rows
        if (description.toLowerCase().includes('subtotal') ||
            description.toLowerCase().includes('tax') ||
            description.toLowerCase().includes('grand total') ||
            description.toLowerCase().includes('current balance')) {
          return;
        }
        
        // Skip main category rows that might have been missed
        const categoryCodePattern = /^\s*\d{4}\s+Calimingo/i;
        const trimmedDescription = description.trim();
        const hasQtyAndExtendedInLineItem = qtyText.trim() && extendedText.trim();
        
        if (categoryCodePattern.test(trimmedDescription) && hasQtyAndExtendedInLineItem) {
          // This looks like a main category row - skip it (already processed above)
          return;
        }
        
        // Extract values
        const qty = extractQuantity(qtyText);
        const extended = extractAmount(extendedText);
        
        // Add line item
        if (description && description.trim().length > 0) {
          items.push({
            type: 'item',
            productService: description,
            qty: qty,
            rate: '', // ProDBX pages don't have rate column
            amount: extended,
            mainCategory: currentMainCategory,
            subCategory: currentSubCategory,
            // NEW: Mark as optional if we're in an optional package section
            ...(currentOptionalPackageNumber ? {
              isOptional: true,
              optionalPackageNumber: currentOptionalPackageNumber,
            } : {}),
          });
        }
      }
    });
    
    if (items.length === 0) {
      throw new Error(`No order items found in Original Contract. Please verify the HTML structure.`);
    }
    
    console.log(`[Original Contract Parser] Successfully parsed Original Contract: ${items.length} items found`);
    
    return items;
  } catch (error) {
    throw new Error(`Failed to parse Original Contract: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetch and parse a single addendum URL
 * @param url - Addendum URL
 * @returns AddendumData
 */
export async function fetchAndParseAddendum(url: string): Promise<AddendumData> {
  try {
    // Validate URL
    if (!validateAddendumUrl(url)) {
      throw new Error(`Invalid addendum URL format: ${url}`);
    }
    
    // Extract addendum number
    const addendumNumber = extractAddendumNumber(url);
    console.log(`[Addendum Parser] Processing addendum #${addendumNumber} from URL: ${url}`);
    
    // Fetch HTML
    const html = await fetchAddendumHTML(url);
    
    // Parse HTML
    const addendumData = parseAddendum(html, addendumNumber, url);
    
    return addendumData;
  } catch (error) {
    throw new Error(`Failed to process addendum URL ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetch and parse multiple addendum URLs
 * @param urls - Array of addendum URLs
 * @returns Array of AddendumData
 */
export async function fetchAndParseAddendums(urls: string[]): Promise<AddendumData[]> {
  const results: AddendumData[] = [];
  const errors: Array<{ url: string; error: string }> = [];
  
  // Process URLs sequentially to avoid overwhelming the server
  for (const url of urls) {
    try {
      const addendumData = await fetchAndParseAddendum(url);
      results.push(addendumData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push({ url, error: errorMessage });
      console.error(`[Addendum Parser] Error processing addendum URL ${url}:`, errorMessage);
      // Continue with other URLs even if one fails
    }
  }
  
  if (errors.length > 0) {
    console.warn(`[Addendum Parser] ${errors.length} addendum(s) failed to process:`, errors);
  }
  
  if (results.length === 0 && urls.length > 0) {
    throw new Error(`All addendum URLs failed to process. Errors: ${errors.map(e => e.error).join('; ')}`);
  }
  
  return results;
}

