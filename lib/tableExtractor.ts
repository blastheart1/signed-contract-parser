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
}

export interface OrderItem {
  type: 'maincategory' | 'subcategory' | 'item';
  productService: string;
  qty: number | string;
  rate: number | string;
  amount: number | string;
  mainCategory?: string | null;
  subCategory?: string | null;
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
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Extract Order ID (flexible pattern: "Order Id:" or "Order ID:" or "OrderId:")
  const orderIdMatch = normalizedText.match(/Order\s*[Ii][Dd][:：]\s*([^\n\r]+)/i);
  if (orderIdMatch) {
    location.orderNo = orderIdMatch[1].trim();
  }

  // Extract DBX Customer ID (flexible pattern)
  const dbxCustomerIdMatch = normalizedText.match(/DBX\s+Customer\s+[Ii][Dd][:：]\s*([^\n\r]+)/i);
  if (dbxCustomerIdMatch) {
    location.dbxCustomerId = dbxCustomerIdMatch[1].trim();
  }

  // Extract Client Name (flexible pattern: "Client:" or "Client :")
  const clientMatch = normalizedText.match(/Client[:：]\s*([^\n\r]+)/i);
  if (clientMatch) {
    location.clientName = clientMatch[1].trim();
  }

  // Extract Street Address (flexible pattern: "Address:" or "Address :")
  const addressMatch = normalizedText.match(/Address[:：]\s*([^\n\r]+)/i);
  if (addressMatch) {
    location.streetAddress = addressMatch[1].trim();
  }

  // Extract City
  const cityMatch = normalizedText.match(/City[:：]\s*([^\n\r]+)/i);
  if (cityMatch) {
    location.city = cityMatch[1].trim();
  }

  // Extract State
  const stateMatch = normalizedText.match(/State[:：]\s*([^\n\r]+)/i);
  if (stateMatch) {
    location.state = stateMatch[1].trim();
  }

  // Extract Zip
  const zipMatch = normalizedText.match(/Zip[:：]\s*([^\n\r]+)/i);
  if (zipMatch) {
    location.zip = zipMatch[1].trim();
  }

  // Debug: Log if key fields are missing
  if (!location.clientName && !location.dbxCustomerId && !location.streetAddress) {
    console.warn('[ExtractLocation] Warning: Could not extract client name, DBX Customer ID, or address from text');
    console.warn('[ExtractLocation] Text sample (first 500 chars):', normalizedText.substring(0, 500));
  }

  return location;
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
    
    // Check if this row is from progress payments table (has "Addendum" or "Phase" headers)
    const hasProgressPaymentsHeaders = rowText.includes('phase') && 
                                       (rowText.includes('completed') || rowText.includes('amt paid') || rowText.includes('date paid'));
    const isAddendumRow = rowText.includes('addendum #') && 
                         (rowText.includes('10/27/2023') || rowText.includes('date paid') || cells.length > 3);
    
    if (rowText.includes('subtotal') || 
        rowText.includes('tax') || 
        rowText.includes('grand total') || 
        rowText.includes('current balance') ||
        rowText.includes('current job balance') ||
        hasProgressPaymentsHeaders ||
        isAddendumRow) {
      // Skip these summary rows and stop parsing (they come after the order items)
      shouldStopParsing = true;
      return;
    }
    
    // Check if this is a sub-category header
    // Pattern 1: class "ssg_title" (older format)
    // Pattern 2: first cell is empty, second cell has border-top style and contains <strong> tag (newer format)
    const firstCell = cells.first();
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

