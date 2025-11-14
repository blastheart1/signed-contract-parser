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
  
  // Find the table with class "pos"
  const table = $('table.pos');
  
  if (table.length === 0) {
    throw new Error('Order Items Table not found');
  }
  
  // Find all rows in the table
  const rows = table.find('tr');
  
  let currentMainCategory: string | null = null;
  let currentSubCategory: string | null = null;
  
  rows.each((index, row) => {
    const $row = $(row);
    const cells = $row.find('td');
    
    // Skip empty rows
    if (cells.length === 0) {
      return;
    }
    
    // Check if this is a sub-category header (class "ssg_title")
    const firstCell = cells.first();
    const isSubCategory = $row.hasClass('ssg_title') || 
                         firstCell.hasClass('ssg_title') ||
                         firstCell.attr('class')?.includes('ssg_title');
    
    if (isSubCategory) {
      const categoryName = cleanText(firstCell.text());
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
    
    // Check if this is a main category (bold text, larger font, has qty and amount)
    if (cells.length >= 3) {
      const firstCellText = firstCell.html() || '';
      const isMainCategory = firstCellText.includes('font-weight: bold') ||
                            firstCellText.includes('font-size: 14px') ||
                            firstCell.find('span[style*="font-weight: bold"]').length > 0 ||
                            firstCell.find('span[style*="font-size: 14px"]').length > 0 ||
                            firstCell.find('strong').length > 0;
      
      if (isMainCategory) {
        // Check if it has a quantity and amount (main categories do)
        const qtyCell = cells.eq(1);
        const amountCell = cells.eq(2);
        const hasQtyAndAmount = qtyCell.text().trim() && amountCell.text().trim();
        
        if (hasQtyAndAmount) {
          // Extract the full category code and name from the bold span
          const boldSpan = firstCell.find('span[style*="font-weight: bold"], span[style*="font-size: 14px"]').first();
          let categoryCodeAndName = '';
          
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

