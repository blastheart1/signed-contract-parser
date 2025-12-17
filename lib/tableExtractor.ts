import { load } from 'cheerio';
import * as cheerio from 'cheerio';

export interface Location {
  orderNo: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  clientName?: string;
  dbxCustomerId?: string;
  email?: string;
  phone?: string;
  orderDate?: string;
  orderPO?: string;
  orderDueDate?: string;
  orderType?: string;
  orderDelivered?: boolean;
  quoteExpirationDate?: string;
  orderGrandTotal?: number;
  progressPayments?: string;
  balanceDue?: number;
  salesRep?: string;
}

export interface OrderItem {
  type: 'maincategory' | 'subcategory' | 'item';
  productService: string;
  qty: number | string;
  rate: number | string;
  amount: number | string;
  mainCategory?: string | null;
  subCategory?: string | null;
  // Progress payment fields (optional, for columns I-N)
  progressOverallPct?: number | string;
  completedAmount?: number | string;
  previouslyInvoicedPct?: number | string;
  previouslyInvoicedAmount?: number | string;
  newProgressPct?: number | string;
  thisBill?: number | string;
  // NEW: Optional package fields (backward compatible)
  isOptional?: boolean; // true if item belongs to an optional package
  optionalPackageNumber?: number; // Package number (1, 2, etc.) if optional
}

/**
 * Extract location information from email text
 * @param text - Email text content
 * @returns Location object with orderNo, streetAddress, city, state, zip
 */
export function extractLocation(text: string): Location {
  const location: Location = {
    orderNo: '',
    streetAddress: '',
    city: '',
    state: '',
    zip: '',
    clientName: '',
    dbxCustomerId: ''
  };

  if (!text || text.trim().length === 0) {
    console.warn('[ExtractLocation] Warning: Empty text provided');
    return location;
  }

  // Normalize text: replace multiple spaces/newlines, handle quoted-printable remnants
  // Also handle asterisk formatting (used in some email formats)
  let normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Helper function to clean extracted values (remove asterisks, trim, handle empty values)
  const cleanValue = (value: string | null): string | null => {
    if (!value) return null;
    
    // Remove all asterisks from the value
    let cleaned = value.replace(/\*/g, '').trim();
    
    // If value is empty or just whitespace after cleaning, return null
    if (!cleaned || cleaned.length === 0) {
      return null;
    }
    
    return cleaned;
  };
  
  // Helper function to extract value, handling both asterisk-formatted and regular formats
  // Pattern handles: "*Label:*Value", "*Label: *Value", "Label:Value", "Label: Value"
  // Note: In the EML file, format is *Label:*Value (asterisk before label, NO asterisk between label and colon, asterisk after colon)
  // Example: *Order Id:*6400 has format *Label:*Value (not *Label*:*Value)
  // Empty values like *Order Po:* should return null
  const extractField = (pattern: string, text: string): string | null => {
    // Try asterisk format: *Label:*Value (most common format in the EML file)
    // Format: *Label:*Value where Label matches the pattern, no asterisk between label and colon, asterisk after colon
    // Example: *Order Id:*6400 matches pattern "Order\s+[Ii][Dd]" -> *Order Id:*6400
    // Use * instead of + to allow empty values (for cases like *Order Po:*)
    const asteriskPattern = new RegExp(`\\*${pattern}[:：]\\*([^\\n\\r]*)`, 'i');
    let match = text.match(asteriskPattern);
    if (match) {
      const cleaned = cleanValue(match[1]);
      // If cleaned value is empty or null, return null (don't set empty strings)
      return cleaned;
    }
    
    // Try asterisk format without asterisk after colon: *Label:Value
    const asteriskNoValueAsterisk = new RegExp(`\\*${pattern}[:：]\\s*([^\\n\\r]*)`, 'i');
    match = text.match(asteriskNoValueAsterisk);
    if (match) {
      return cleanValue(match[1]);
    }
    
    // Try asterisk format with asterisk around label: *Label*:Value
    const asteriskLabelPattern = new RegExp(`\\*${pattern}\\*[:：]\\s*([^\\n\\r]*)`, 'i');
    match = text.match(asteriskLabelPattern);
    if (match) {
      return cleanValue(match[1]);
    }
    
    // Try asterisk format with space after colon: *Label: *Value
    const asteriskSpacePattern = new RegExp(`\\*${pattern}[:：]\\s+([^\\n\\r]+)`, 'i');
    match = text.match(asteriskSpacePattern);
    if (match) {
      return cleanValue(match[1]);
    }
    
    // Fall back to regular format (no asterisks)
    const regularPattern = new RegExp(`${pattern}[:：]\\s*([^\\n\\r]*)`, 'i');
    match = text.match(regularPattern);
    if (match) {
      return cleanValue(match[1]);
    }
    
    return null;
  };

  // Extract Order ID (handles both formats)
  // Pattern needs to match "Order Id" or "Order ID" or "OrderId" with optional space
  const orderIdValue = extractField('Order\\s+[Ii][Dd]', normalizedText);
  if (orderIdValue) {
    location.orderNo = orderIdValue;
  }

  // Extract DBX Customer ID (handles both formats)
  const dbxCustomerIdValue = extractField('DBX\\s+Customer\\s+[Ii][Dd]', normalizedText);
  if (dbxCustomerIdValue) {
    location.dbxCustomerId = dbxCustomerIdValue;
  }

  // Extract Client Name (handles both formats)
  const clientValue = extractField('Client', normalizedText);
  if (clientValue) {
    location.clientName = clientValue;
  }

  // Extract Street Address (handles both formats)
  const addressValue = extractField('Address', normalizedText);
  if (addressValue) {
    location.streetAddress = addressValue;
  }

  // Extract City (handles both formats)
  const cityValue = extractField('City', normalizedText);
  if (cityValue) {
    location.city = cityValue;
  }

  // Extract State (handles both formats)
  const stateValue = extractField('State', normalizedText);
  if (stateValue) {
    location.state = stateValue;
  }

  // Extract Zip (handles both formats)
  const zipValue = extractField('Zip', normalizedText);
  if (zipValue) {
    location.zip = zipValue;
  }

  // Extract Email (handles both formats)
  const emailValue = extractField('Email', normalizedText);
  if (emailValue) {
    location.email = emailValue;
  }

  // Extract Phone (handles both formats)
  const phoneValue = extractField('Phone', normalizedText);
  if (phoneValue) {
    location.phone = phoneValue;
  }

  // Extract Order Date (handles both formats)
  const orderDateValue = extractField('Order\\s+Date', normalizedText);
  if (orderDateValue && orderDateValue !== '0') {
    location.orderDate = orderDateValue;
  }

  // Extract Order PO (handles both formats)
  const orderPOValue = extractField('Order\\s+Po', normalizedText);
  if (orderPOValue) {
    location.orderPO = orderPOValue;
  }

  // Extract Order Due Date (handles both formats)
  const orderDueDateValue = extractField('Order\\s+Due\\s+Date', normalizedText);
  if (orderDueDateValue && orderDueDateValue !== '0') {
    location.orderDueDate = orderDueDateValue;
  }

  // Extract Order Type (handles both formats)
  const orderTypeValue = extractField('Order\\s+Type', normalizedText);
  if (orderTypeValue) {
    location.orderType = orderTypeValue;
  }

  // Extract Order Delivered (handles both formats)
  const orderDeliveredValue = extractField('Order\\s+Delivered', normalizedText);
  if (orderDeliveredValue) {
    const deliveredStr = orderDeliveredValue.toLowerCase();
    location.orderDelivered = deliveredStr === '0' || deliveredStr === 'false' || deliveredStr === 'no' ? false : (deliveredStr === '1' || deliveredStr === 'true' || deliveredStr === 'yes' ? true : undefined);
  }

  // Extract Quote Expiration Date (handles both formats)
  const quoteExpirationValue = extractField('Quote\\s+Expiration\\s+Date', normalizedText);
  if (quoteExpirationValue && quoteExpirationValue !== '0') {
    location.quoteExpirationDate = quoteExpirationValue;
  }

  // Extract Order Grand Total (handles both formats)
  const orderGrandTotalValue = extractField('Order\\s+Grand\\s+Total', normalizedText);
  if (orderGrandTotalValue) {
    // Remove commas, dollar signs, and any remaining asterisks
    const totalStr = orderGrandTotalValue.replace(/[$,*]/g, '').trim();
    const parsed = parseFloat(totalStr);
    if (!isNaN(parsed) && parsed > 0) {
      location.orderGrandTotal = parsed;
    }
  }

  // Extract Progress Payments (handles both formats)
  const progressPaymentsValue = extractField('Progress\\s+Payments', normalizedText);
  if (progressPaymentsValue) {
    location.progressPayments = progressPaymentsValue;
  }

  // Extract Balance Due (handles both formats)
  const balanceDueValue = extractField('Balance\\s+Due', normalizedText);
  if (balanceDueValue) {
    // Remove commas, dollar signs, and any remaining asterisks
    const balanceStr = balanceDueValue.replace(/[$,*]/g, '').trim();
    const parsed = parseFloat(balanceStr);
    if (!isNaN(parsed) && parsed >= 0) {
      location.balanceDue = parsed;
    }
  }

  // Extract Sales Rep (handles both formats)
  const salesRepValue = extractField('Sales\\s+Rep', normalizedText);
  if (salesRepValue) {
    location.salesRep = salesRepValue || undefined;
  }

  // Debug: Log if key fields are missing
  if (!location.clientName && !location.dbxCustomerId && !location.streetAddress) {
    console.warn('[ExtractLocation] Warning: Could not extract client name, DBX Customer ID, or address from text');
    console.warn('[ExtractLocation] Text sample (first 500 chars):', normalizedText.substring(0, 500));
  }

  return location;
}

/**
 * Check if a value contains asterisks (indicating parsing issue)
 * @param value - Value to check
 * @returns true if value contains asterisks
 */
function hasAsterisks(value: string | undefined | null): boolean {
  if (!value) return false;
  return value.includes('*');
}

/**
 * Check if location extraction was successful and accurate
 * @param location - Location object to validate
 * @returns true if key fields are present and accurate, false otherwise
 */
export function isLocationValid(location: Location): boolean {
  // Check if we have at least the essential fields
  const hasClientName = !!location.clientName && location.clientName.trim().length > 0;
  const hasDbxCustomerId = !!location.dbxCustomerId && location.dbxCustomerId.trim().length > 0;
  const hasAddress = !!location.streetAddress && location.streetAddress.trim().length > 0;
  const hasOrderNo = !!location.orderNo && location.orderNo.trim().length > 0;
  
  // Check for parsing accuracy issues (asterisks in values indicate incomplete parsing)
  const hasAsteriskIssues = 
    hasAsterisks(location.clientName) ||
    hasAsterisks(location.dbxCustomerId) ||
    hasAsterisks(location.streetAddress) ||
    hasAsterisks(location.city) ||
    hasAsterisks(location.state) ||
    hasAsterisks(location.zip) ||
    hasAsterisks(location.orderNo) ||
    hasAsterisks(location.email) ||
    hasAsterisks(location.phone) ||
    hasAsterisks(location.orderPO) ||
    hasAsterisks(location.orderType) ||
    hasAsterisks(location.progressPayments) ||
    hasAsterisks(location.salesRep);
  
  // If there are asterisk issues, parsing is not accurate
  if (hasAsteriskIssues) {
    console.warn('[ExtractLocation] Parsing accuracy issue detected: values contain asterisks');
    return false;
  }
  
  // Consider valid if we have client name OR DBX Customer ID, AND address, AND order number
  return (hasClientName || hasDbxCustomerId) && hasAddress && hasOrderNo;
}

// Validation functions moved to lib/orderItemsValidation.ts for client-side compatibility
// Re-export for backward compatibility with server-side code
export { calculateOrderItemsTotal, validateOrderItemsTotal } from './orderItemsValidation';

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
 * Extract Order Items Table from HTML
 * @param html - HTML content from email
 * @returns Array of order items with category headers
 */
export function extractOrderItems(html: string): OrderItem[] {
  const $ = load(html);
  const items: OrderItem[] = [];
  
  // First, try to find the table with class "pos" (for backward compatibility)
  let table = $('table.pos');
  
  // If not found, look for a table that contains the order items header
  // The table should have a row with "DESCRIPTION", "QTY", "EXTENDED" headers
  if (table.length === 0) {
    // Find all tables in the document
    const allTables = $('table');
    
    // Look for a table that has the order items header row
    for (let i = 0; i < allTables.length; i++) {
      const candidateTable = $(allTables[i]);
      const rows = candidateTable.find('tr');
      
      // Check if any row contains the header pattern
      let foundHeader = false;
      rows.each((_index, row) => {
        const $row = $(row);
        const cells = $row.find('td');
        if (cells.length >= 3) {
          const firstCellText = cleanText(cells.eq(0).text()).toUpperCase();
          const secondCellText = cleanText(cells.eq(1).text()).toUpperCase();
          const thirdCellText = cleanText(cells.eq(2).text()).toUpperCase();
          
          // Check if this row matches the header pattern
          if ((firstCellText.includes('DESCRIPTION') || firstCellText === 'DESCRIPTION') &&
              (secondCellText.includes('QTY') || secondCellText === 'QTY') &&
              (thirdCellText.includes('EXTENDED') || thirdCellText === 'EXTENDED')) {
            foundHeader = true;
            return false; // Break the loop
          }
        }
      });
      
      if (foundHeader) {
        table = candidateTable;
        break;
      }
    }
  }
  
  if (table.length === 0) {
    throw new Error('Order Items Table not found');
  }
  
  // Find all rows in the table
  // Use direct children only to avoid nested tables (like progress payments table)
  const rows = table.children('tbody').length > 0 
    ? table.children('tbody').children('tr')
    : table.children('tr');
  
  // Convert to array so we can look ahead to next row
  const rowsArray: any[] = [];
  rows.each((_index, row) => {
    rowsArray.push(row);
  });
  
  let currentMainCategory: string | null = null;
  let currentSubCategory: string | null = null;
  let shouldStopParsing = false;
  
  rowsArray.forEach((row, index) => {
    // If we've encountered a stop condition, skip remaining rows
    if (shouldStopParsing) {
      return;
    }
    
    const $row = $(row);
    
    // Get cells first (needed for later checks)
    const cells = $row.find('> td'); // Only direct child cells
    
    // Check if this row contains a nested table FIRST - if so, extract all Addendums and stop parsing
    // Nested tables are typically in cells with colspan (like progress payments)
    // This check must happen before other checks to ensure we extract addendums
    const nestedTable = $row.find('td table').first();
    if (nestedTable.length > 0) {
      // This row contains a nested table (like progress payments)
      // Extract all addendum entries from the progress payments table
      const progressPaymentsRows = nestedTable.find('tbody tr, tr');
      const addendums: Array<{ name: string; amount: number }> = [];
      
      progressPaymentsRows.each((_progressIndex, progressRow) => {
        const $progressRow = $(progressRow);
        const progressRowText = cleanText($progressRow.text());
        
        // Check if this row contains an addendum (pattern: "Addendum #1", "Addendum #2", etc.)
        // Also check for case variations and spacing
        const addendumMatch = progressRowText.match(/addendum\s*#\s*(\d+)/i);
        if (addendumMatch) {
          const addendumNumber = addendumMatch[1];
          const addendumName = `Addendum #${addendumNumber}`;
          
          // Extract the amount from the AMT column (usually 3rd column, index 2)
          const progressCells = $progressRow.find('td');
          if (progressCells.length >= 3) {
            // The AMT column is typically the 3rd column (index 2)
            // But we'll also check other columns to be safe
            let addendumAmount = 0;
            
            // First, try the 3rd column (AMT column)
            const amtCell = progressCells.eq(2);
            const amtText = cleanText(amtCell.text());
            addendumAmount = parseFloat(amtText.replace(/[$,]/g, '')) || 0;
            
            // If not found in 3rd column, search all cells for the largest reasonable amount
            if (addendumAmount === 0 || addendumAmount < 1) {
              let maxAmount = 0;
              progressCells.each((_cellIndex, cell) => {
                const $cell = $(cell);
                const cellText = cleanText($cell.text());
                const cellAmount = parseFloat(cellText.replace(/[$,]/g, '')) || 0;
                
                // If we find a reasonable amount (between 1 and 1000000), track the max
                if (cellAmount >= 1 && cellAmount <= 1000000 && cellAmount > maxAmount) {
                  maxAmount = cellAmount;
                }
              });
              if (maxAmount > 0) {
                addendumAmount = maxAmount;
              }
            }
            
            // If we found an amount, store it for later addition
            if (addendumAmount > 0) {
              addendums.push({
                name: addendumName,
                amount: addendumAmount
              });
            }
          }
        }
      });
      
      // Add all found addendums as Main Category line items at the end
      if (addendums.length > 0) {
        addendums.forEach((addendum) => {
          items.push({
            type: 'maincategory',
            productService: `${addendum.name}:`,
            qty: '',
            rate: '',
            amount: ''
          });
          
          items.push({
            type: 'item',
            productService: addendum.name,
            qty: 1,
            rate: addendum.amount,
            amount: addendum.amount,
            mainCategory: `${addendum.name}:`
          });
        });
      }
      
      // Stop parsing after extracting all addendums
      shouldStopParsing = true;
      return;
    }
    
    // Skip rows with no cells
    if (cells.length === 0) {
      return;
    }
    
    // Check for subtotal/tax/grand total rows early (they may have colspan and fewer cells)
    // These rows often have "Subtotal", "Tax", "Grand Total", or "Current Balance" text
    const rowText = cleanText($row.text()).toLowerCase();
    const firstCell = cells.first();
    const firstCellText = cleanText(firstCell.text()).toLowerCase();
    
    // Check if this row is from progress payments table (has "Addendum" or "Phase" headers)
    const hasProgressPaymentsHeaders = rowText.includes('phase') && 
                                       (rowText.includes('completed') || rowText.includes('amt paid') || rowText.includes('date paid'));
    const isAddendumRow = rowText.includes('addendum #') && 
                         (rowText.includes('10/27/2023') || rowText.includes('date paid') || cells.length > 3);
    
    // Make summary row detection more specific - only match actual summary rows
    // Summary rows typically have the summary term as the main/only text in first cell
    const isSummaryRow = 
      // Check if first cell text is exactly or primarily a summary term
      (firstCellText === 'subtotal' || 
       firstCellText === 'tax' || 
       firstCellText === 'grand total' ||
       firstCellText === 'current balance' ||
       firstCellText === 'current job balance' ||
       firstCellText.trim().startsWith('subtotal') ||
       firstCellText.trim().startsWith('tax') ||
       firstCellText.trim().startsWith('grand total') ||
       firstCellText.trim().startsWith('current balance') ||
       firstCellText.trim().startsWith('current job balance')) ||
      // Check if row text matches summary patterns exactly (not just contains)
      (rowText.match(/^\s*subtotal\s*$/i) ||
       rowText.match(/^\s*tax\s*$/i) ||
       rowText.match(/^\s*grand\s+total\s*$/i) ||
       rowText.match(/^\s*current\s+(job\s+)?balance\s*$/i)) ||
      // Progress payments headers
      hasProgressPaymentsHeaders ||
      isAddendumRow;
    
    if (isSummaryRow) {
      // Skip this summary row but continue parsing (don't stop entirely)
      return;
    }
    
    // Check if this is a sub-category header
    // Pattern 1: class "ssg_title" (older format)
    // Pattern 2: first cell is empty, second cell has border-top style and contains <strong> tag (newer format)
    // Note: firstCell is already defined above, so we reuse it
    const secondCell = cells.eq(1);
    
    const isSubCategoryByClass = $row.hasClass('ssg_title') || 
                                 firstCell.hasClass('ssg_title') ||
                                 firstCell.attr('class')?.includes('ssg_title');
    
    // Check for newer format: first cell empty, second cell has border-top style
    const firstCellTextForSubcat = cleanText(firstCell.text());
    const secondCellStyle = secondCell.attr('style') || '';
    const hasBorderTopStyle = secondCellStyle.includes('border-top:solid 1px #bbb') ||
                             secondCellStyle.includes('border-top:solid 1px #BBB');
    const hasLetterSpacing = secondCellStyle.includes('letter-spacing:2px');
    const secondCellHasStrong = secondCell.find('strong').length > 0;
    const isSubCategoryByStyle = (firstCellTextForSubcat === '' || firstCellTextForSubcat.trim().length === 0) &&
                                hasBorderTopStyle &&
                                hasLetterSpacing &&
                                secondCellHasStrong &&
                                cells.length >= 2;
    
    const isSubCategory = isSubCategoryByClass || isSubCategoryByStyle;
    
    if (isSubCategory) {
      let categoryName = '';
      if (isSubCategoryByClass) {
        categoryName = cleanText(firstCell.text());
      } else if (isSubCategoryByStyle) {
        // Extract from second cell's <strong> tag
        const strongTag = secondCell.find('strong').first();
        if (strongTag.length > 0) {
          categoryName = cleanText(strongTag.text());
        } else {
          categoryName = cleanText(secondCell.text());
        }
      }
      
      if (categoryName && categoryName.trim().length > 0) {
        currentSubCategory = categoryName;
        items.push({
          type: 'subcategory',
          productService: categoryName,
          qty: '',
          rate: '',
          amount: ''
        });
      }
      return;
    }
    
    // Check if this is a main category
    // Pattern 1: Old format - bold span with font-weight: bold or font-size: 14px
    // Pattern 2: New format - border-top:solid 1px #666 style with category code pattern
    if (cells.length >= 3) {
      const firstCellStyle = firstCell.attr('style') || '';
      const firstCellText = firstCell.html() || '';
      const firstCellPlainText = cleanText(firstCell.text());
      
      // Check for old format (bold span)
      const isMainCategoryOldFormat = firstCellText.includes('font-weight: bold') ||
                                      firstCellText.includes('font-size: 14px') ||
                                      firstCell.find('span[style*="font-weight: bold"]').length > 0 ||
                                      firstCell.find('span[style*="font-size: 14px"]').length > 0 ||
                                      firstCell.find('strong').length > 0;
      
      // Check for new format (border-top style with category code pattern)
      // Main categories in new format have: border-top:solid 1px #666 and start with category code (e.g., "0024", "0040")
      // Note: border-top:solid 1px #BBB is for subcategories, not main categories
      const hasBorderTopStyle = firstCellStyle.includes('border-top:solid 1px #666');
      // Category code pattern: starts with 4 digits followed by " Calimingo"
      const matchesCategoryPattern = /^\d{4}\s+Calimingo/.test(firstCellPlainText);
      const isMainCategoryNewFormat = hasBorderTopStyle && matchesCategoryPattern;
      
      const isMainCategory = isMainCategoryOldFormat || isMainCategoryNewFormat;
      
      if (isMainCategory) {
        // Check if it has a quantity and amount (main categories do)
        const qtyCell = cells.eq(1);
        const amountCell = cells.eq(2);
        const qtyText = cleanText(qtyCell.text());
        const amountText = cleanText(amountCell.text());
        const hasQtyAndAmount = qtyText.trim() && amountText.trim();
        
        if (hasQtyAndAmount) {
          let categoryCodeAndName = '';
          
          if (isMainCategoryOldFormat) {
            // Extract the full category code and name from the bold span (old format)
            const boldSpan = firstCell.find('span[style*="font-weight: bold"], span[style*="font-size: 14px"]').first();
            
            if (boldSpan.length > 0) {
              categoryCodeAndName = cleanText(boldSpan.text());
            } else {
              // Fallback to strong tag or full text
              const strongTag = firstCell.find('strong').first();
              if (strongTag.length > 0) {
                categoryCodeAndName = cleanText(strongTag.text());
              } else {
                categoryCodeAndName = cleanText(firstCell.text());
              }
            }
          } else if (isMainCategoryNewFormat) {
            // New format: category name is directly in the cell text
            // The category name comes before any <br> or <em> tag
            // Extract text up to the first <br> or <em> tag
            const cellHtml = firstCell.html() || '';
            
            // Find where the category name ends (before <br> or <em>)
            const brIndex = cellHtml.indexOf('<br');
            const emIndex = cellHtml.indexOf('<em');
            const endIndex = brIndex > -1 && emIndex > -1 
              ? Math.min(brIndex, emIndex)
              : brIndex > -1 
                ? brIndex 
                : emIndex > -1 
                  ? emIndex 
                  : cellHtml.length;
            
            // Extract category name (text before <br> or <em>)
            const categoryHtml = cellHtml.substring(0, endIndex);
            // Clean HTML tags but keep text
            categoryCodeAndName = cleanText(categoryHtml.replace(/<\/?[^>]+(>|$)/g, ' '));
          }
          
          // Extract description from <em> tag (comes after the category, separated by <br>)
          const emTag = firstCell.find('em').first();
          const description = emTag.length > 0 ? cleanText(emTag.text()) : '';
          
          // Build the full category string: "0020 Calimingo - Pools and Spas - R2:"
          // or "0110 Calimingo - Pavers - All pavers on pool side of upper yard - Includes entry:"
          let fullCategoryName = categoryCodeAndName.trim();
          
          // Remove any trailing colon from category code and name (if present in HTML)
          fullCategoryName = fullCategoryName.replace(/:\s*$/, '').trim();
          
          // Add description if present
          if (description) {
            fullCategoryName = `${fullCategoryName} - ${description}`;
          }
          
          // Always add colon at the end
          fullCategoryName = `${fullCategoryName}:`;
          
          if (fullCategoryName && fullCategoryName.length > 0) {
            currentMainCategory = fullCategoryName;
            currentSubCategory = null; // Reset sub-category when new main category starts
            
            items.push({
              type: 'maincategory',
              productService: fullCategoryName,
              qty: '',
              rate: '',
              amount: ''
            });
            
            // Check if the next row is a subtotal row (main category has no items)
            // If so, include the main category amount as a line item
            if (index + 1 < rowsArray.length) {
              const nextRow = $(rowsArray[index + 1]);
              const nextRowText = cleanText(nextRow.text()).toLowerCase();
              
              // If next row is subtotal, this main category has no items
              // Include the main category amount as a line item
              if (nextRowText.includes('subtotal')) {
                const amountCell = cells.eq(2);
                const amountStr = cleanText(amountCell.text());
                const amount = parseFloat(amountStr.replace(/[$,]/g, '')) || 0;
                
                if (amount > 0) {
                  const qtyCell = cells.eq(1);
                  const qtyText = cleanText(qtyCell.text());
                  const qty = extractQuantity(qtyText);
                  const rate = qty > 0 ? amount / qty : amount;
                  
                  items.push({
                    type: 'item',
                    productService: fullCategoryName.replace(/:\s*$/, ''), // Remove trailing colon for item
                    qty: qty,
                    rate: rate,
                    amount: amount,
                    mainCategory: fullCategoryName
                  });
                }
              }
            }
            
            // Don't process this row as a line item
            return;
          }
        }
      }
    }
    
    // Check if this is a regular line item (has padding-left: 30px or is a data row)
    if (cells.length >= 3) {
      const firstCellStyle = firstCell.attr('style') || '';
      const isIndented = firstCellStyle.includes('padding-left: 30px') || 
                        firstCellStyle.includes('padding-left:30px');
      
      // Extract text properly - get all text content, including from nested tags
      // Remove any formatting tags like <strong> or <em> to get plain text
      const cellHtml = firstCell.html() || '';
      // Remove HTML formatting tags but keep their text content
      const plainText = cellHtml
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '$1')
        .replace(/<em[^>]*>(.*?)<\/em>/gi, '$1')
        .replace(/<b[^>]*>(.*?)<\/b>/gi, '$1')
        .replace(/<i[^>]*>(.*?)<\/i>/gi, '$1')
        .replace(/<br\s*\/?>/gi, ' ') // Replace <br> with space
        .replace(/<\/?[^>]+(>|$)/g, ' '); // Remove any remaining HTML tags
      const description = cleanText(plainText);
      const qtyCell = cells.eq(1);
      const amountCell = cells.eq(2);
      
      const qtyText = cleanText(qtyCell.text());
      const amountText = cleanText(amountCell.text());
      
      // Skip if this looks like a header row
      if (description.toLowerCase().includes('description') && 
          qtyText.toLowerCase().includes('qty')) {
        return;
      }
      
      // Skip if description is empty or just whitespace
      if (!description || description.trim().length === 0) {
        return;
      }
      
      // Skip subtotal/tax/grand total rows
      if (description.toLowerCase().includes('subtotal') ||
          description.toLowerCase().includes('tax') ||
          description.toLowerCase().includes('grand total') ||
          description.toLowerCase().includes('current balance')) {
        return;
      }
      
      // Only process if it's an indented item or has valid qty/amount
      // Items without indentation must have both qty and amount to be considered valid line items
      if (isIndented || (qtyText && amountText)) {
        // Extract quantity
        const qty = extractQuantity(qtyText);
        
        // Extract amount (remove $ and commas, handle strong tags)
        let amountStr = amountText;
        // If amount cell has strong tag, get that text
        const strongTag = amountCell.find('strong');
        if (strongTag.length > 0) {
          amountStr = cleanText(strongTag.text());
        }
        const amount = parseFloat(amountStr.replace(/[$,]/g, '')) || 0;
        
        // Calculate rate
        const rate = qty > 0 ? amount / qty : 0;
        
        // Only add if we have meaningful data
        // For indented items, include even if amount is 0 (they might be placeholders)
        // For non-indented items, only include if amount > 0 (they must have a value)
        // Also ensure we have a valid description
        if (description && description.trim().length > 0 && (amount > 0 || isIndented)) {
          items.push({
            type: 'item',
            productService: description,
            qty: qty,
            rate: rate,
            amount: amount,
            mainCategory: currentMainCategory,
            subCategory: currentSubCategory
          });
        }
      }
    }
  });
  
  return items;
}

