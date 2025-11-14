import ExcelJS from 'exceljs';
import path from 'path';
import { OrderItem, Location } from './tableExtractor';

/**
 * Sanitize sheet name for Excel (max 31 chars, no invalid characters)
 * @param name - Sheet name to sanitize
 * @returns Sanitized sheet name
 */
function sanitizeSheetName(name: string): string {
  // Remove invalid characters: \, /, ?, *, [, ]
  let sanitized = name.replace(/[\\/?*[\]]/g, '');
  
  // Truncate to 31 characters (Excel max sheet name length)
  if (sanitized.length > 31) {
    sanitized = sanitized.substring(0, 31);
  }
  
  return sanitized;
}

/**
 * Find the last data row in the worksheet (scanning from row 16 up to row 465)
 * Template has 460 buffer rows, can fill up to row 465 for items
 * @param worksheet - Excel worksheet
 * @returns Last row number with data, or 15 if none found
 */
function findLastDataRow(worksheet: ExcelJS.Worksheet): number {
  let lastRow = 15; // Start from row 16 (0-indexed is 15)
  
  // Scan from row 16 to row 465 (buffer rows provided by template)
  for (let rowNum = 16; rowNum <= 465; rowNum++) {
    const cellD = worksheet.getCell(rowNum, 4); // Column D
    const cellF = worksheet.getCell(rowNum, 6); // Column F
    const cellG = worksheet.getCell(rowNum, 7); // Column G
    const cellH = worksheet.getCell(rowNum, 8); // Column H
    
    // Check if this row has data in D, F, G, or H
    if (cellD.value || cellF.value || cellG.value || cellH.value) {
      lastRow = rowNum;
    }
  }
  
  return lastRow;
}


/**
 * Clean shared formulas from worksheet to prevent cloning errors
 * Converts shared formulas to regular formulas for rows that might be affected
 * This is the "Alternative Quick Fix" - only clean rows 16-465 we'll be working with
 * @param worksheet - Excel worksheet
 * @param startRow - Start row number (default 16)
 * @param endRow - End row number (default 465)
 */
function cleanSharedFormulasFromRange(worksheet: ExcelJS.Worksheet, startRow: number = 16, endRow: number = 465): void {
  try {
    // Clear shared formulas from worksheet model immediately (if it exists)
    if (worksheet.model && (worksheet.model as any).sharedFormulas) {
      // Clear all shared formula definitions from model
      (worksheet.model as any).sharedFormulas = {};
    }
    
    // For each cell in our range, check if it has a shared formula reference
    // Convert shared formulas to regular formulas
    for (let rowNum = startRow; rowNum <= endRow; rowNum++) {
      for (let colNum = 1; colNum <= 100; colNum++) {
        try {
          const cell = worksheet.getCell(rowNum, colNum);
          
          // Check if cell has shared formula reference in value object
          // ExcelJS stores shared formulas as: { sharedFormula: 'J17' }
          // We need to convert this to a regular formula
          const cellValue = cell.value;
          
          if (cellValue && typeof cellValue === 'object' && !Array.isArray(cellValue)) {
            const valueObj = cellValue as any;
            
            // If cell has sharedFormula property in value object
            if (valueObj.sharedFormula) {
              // Cell has a shared formula reference
              // If cell already has a formula, convert it to regular formula
              if (cell.formula) {
                // Convert to regular formula - use existing formula string
                cell.value = { formula: cell.formula };
              } else {
                // No formula available, try to get from master cell
                const masterRef = valueObj.sharedFormula;
                
                try {
                  // Parse master cell reference (e.g., "J17" -> row 17, col 10)
                  const colLetter = masterRef.match(/[A-Z]+/)?.[0];
                  const masterRowNum = parseInt(masterRef.match(/\d+/)?.[0] || '0');
                  
                  if (colLetter && masterRowNum > 0) {
                    // Convert column letter to number (A=1, B=2, ..., Z=26, AA=27, etc.)
                    let masterColNum = 0;
                    for (let i = 0; i < colLetter.length; i++) {
                      masterColNum = masterColNum * 26 + (colLetter.charCodeAt(i) - 64);
                    }
                    
                    // Try to get master cell's formula
                    const masterCell = worksheet.getCell(masterRowNum, masterColNum);
                    if (masterCell && masterCell.formula) {
                      // Apply master formula as regular formula
                      // Adjust row references in formula (e.g., I17 -> I19 for row 19)
                      let formulaStr = masterCell.formula;
                      
                      // Replace row numbers in formula (simple replacement)
                      // This adjusts relative references
                      const rowDiff = rowNum - masterRowNum;
                      if (rowDiff !== 0) {
                        // Replace row numbers: I17 -> I19 if rowNum=19 and masterRowNum=17
                        formulaStr = formulaStr.replace(new RegExp(`${masterRowNum}\\b`, 'g'), rowNum.toString());
                      }
                      
                      cell.value = { formula: formulaStr };
                    } else {
                      // Master doesn't exist, clear the cell
                      cell.value = null;
                    }
                  } else {
                    // Can't parse master reference, clear the cell
                    cell.value = null;
                  }
                } catch (e) {
                  // If we can't resolve shared formula, clear it
                  cell.value = null;
                }
              }
            }
          }
          
          // Also clear sharedFormula property if it exists directly on cell object
          if ((cell as any).sharedFormula) {
            delete (cell as any).sharedFormula;
          }
        } catch (e) {
          // Ignore errors for cells that don't exist
        }
      }
    }
  } catch (e) {
    // If cleaning fails, log but continue
    console.warn('Warning: Could not clean shared formulas:', e);
  }
}

/**
 * Completely reset cell formatting to remove all bold
 * CRITICAL: Template stores formatting in model.style.font
 * We need to completely remove or reset the style to prevent inheritance
 * @param cell - Excel cell to clear formatting from
 */
function clearBoldFromCell(cell: ExcelJS.Cell): void {
  const cellModel = (cell as any).model;
  
  if (!cellModel) return;
  
  // Method 1: Completely remove font from style object if it exists
  if (cellModel.style && cellModel.style.font) {
    // Create a new font object without bold
    const existingFont = cellModel.style.font;
    cellModel.style.font = {
      ...existingFont,
      bold: false
    };
    // Also try to remove bold property entirely
    if (cellModel.style.font.bold !== false) {
      delete cellModel.style.font.bold;
    }
  }
  
  // Method 2: Clear from model.font if it exists
  if (cellModel.font) {
    cellModel.font.bold = false;
  }
  
  // Method 3: Set font property directly - this should override everything
  // Get size from existing font if available, otherwise use default
  const existingFont = cell.font || {};
  const fontSize = (existingFont as any).size || 11;
  
  // Set font with bold explicitly false and preserve size
  cell.font = {
    size: fontSize,
    bold: false
  };
}

/**
 * Generate Excel spreadsheet from order items, appending to template
 * @param items - Array of order items
 * @param location - Location object with orderNo, streetAddress, city, state, zip
 * @param applyFormatting - Whether to apply formatting (default: false)
 * @returns Excel file buffer
 */
export async function generateSpreadsheet(items: OrderItem[], location: Location, applyFormatting: boolean = false): Promise<Buffer> {
  // Load template file
  const templatePath = path.join(process.cwd(), 'contract-parser', 'template.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);
  
  // Get the first worksheet (or named "Order Items")
  let worksheet = workbook.getWorksheet('Order Items') || workbook.worksheets[0];
  
  // Clean shared formulas from rows 16-465 (rows we'll be working with)
  // This prevents "Shared Formula master must exist" errors when saving
  cleanSharedFormulasFromRange(worksheet, 16, 465);
  
  // Rename worksheet to "#OrderNo-Street Address"
  const sheetName = sanitizeSheetName(`#${location.orderNo}-${location.streetAddress}`);
  worksheet.name = sheetName;
  
  // Find last data row (scanning up to row 465 - buffer rows provided by template)
  const lastDataRow = findLastDataRow(worksheet);
  let currentRow: number;
  
  // Check if row 16 already has a location
  const row16CellD = worksheet.getCell(16, 4);
  const hasLocationRow = row16CellD.value && row16CellD.value.toString().includes('Pool & Spa');
  
  // Determine starting row for line items
  if (hasLocationRow) {
    // Location already exists, start appending after last data row
    currentRow = lastDataRow + 1;
  } else {
    // No location row, add it at row 16
    // Clean location header text to remove any special formatting characters
    let locationHeader = `Pool & Spa - ${location.city}, ${location.state} ${location.zip}, United States`;
    // Remove any zero-width characters or formatting characters that might affect formatting
    locationHeader = locationHeader.replace(/[\u200B-\u200D\uFEFF]/g, ''); // Zero-width spaces
    locationHeader = locationHeader.replace(/[\u202A-\u202E]/g, ''); // Directional formatting
    locationHeader = locationHeader.replace(/[\u2060-\u206F]/g, ''); // Word joiner, invisible separator
    locationHeader = locationHeader.replace(/\s+/g, ' ').trim();
    
    const locationCell = worksheet.getCell(16, 4);
    const locationCellE = worksheet.getCell(16, 5);
    
    // CRITICAL: Completely reset formatting from template BEFORE setting value
    // Template row 16 has bold in model.style.font - we need to remove it completely
    const locationCellModel = (locationCell as any).model;
    const locationCellEModel = (locationCellE as any).model;
    
    // Set the value FIRST (as plain text)
    locationCell.value = locationHeader; // Column D
    
    // NOW set font explicitly - must come AFTER setting value
    // Create completely new font object (don't preserve template properties)
    locationCell.font = { size: 11, bold: false };
    locationCellE.font = { size: 11, bold: false };
    locationCell.alignment = { vertical: 'middle', wrapText: true };
    
    // Remove any fill color
    if ((locationCell as any).fill) {
      delete (locationCell as any).fill;
    }
    if ((locationCellE as any).fill) {
      delete (locationCellE as any).fill;
    }
    
    // Reset model.style.font AFTER setting value and font
    // This ensures our font setting takes precedence
    if (locationCellModel && locationCellModel.style) {
      // Replace entire font object - don't preserve any template properties
      locationCellModel.style.font = {
        size: 11,
        bold: false
      };
      // Remove fill
      if (locationCellModel.style.fill) {
        delete locationCellModel.style.fill;
      }
    }
    if (locationCellEModel && locationCellEModel.style) {
      locationCellEModel.style.font = {
        size: 11,
        bold: false
      };
      if (locationCellEModel.style.fill) {
        delete locationCellEModel.style.fill;
      }
    }
    
    // Merge D:E for location row (check if already merged first)
    try {
      // Check if cells are already part of a merge before merging
      const isMerged = worksheet.model.merges?.some((merge: any) => {
        return merge.top <= 16 && merge.bottom >= 16 &&
               merge.left <= 4 && merge.right >= 5;
      });
      if (!isMerged) {
        worksheet.mergeCells(16, 4, 16, 5);
      }
    } catch (e) {
      // Merge might already exist, ignore error
    }
    
    // AFTER merge, FORCE font to not bold
    // Merge can copy formatting, so we need to reset it again
    const mergedLocationCell = worksheet.getCell(16, 4);
    mergedLocationCell.font = { size: 11, bold: false };
    
    // Replace model.style.font completely after merge
    const mergedModel = (mergedLocationCell as any).model;
    if (mergedModel && mergedModel.style) {
      mergedModel.style.font = {
        size: 11,
        bold: false
      };
    }
    
    currentRow = 17; // Next row for line items
  }
  
  // Process items and append them
  // Track header rows for styling (only used when applyFormatting is true)
  const headerRows: Array<{ row: number, type: 'maincategory' | 'subcategory' }> = [];
  
  for (const item of items) {
    // SKIP main category headers - user doesn't want them after the main header (row 16)
    if (item.type === 'maincategory') {
      // Just skip main categories - don't write them to the spreadsheet
      continue;
    } else if (item.type === 'subcategory') {
      // Sub-category header row
      const row = currentRow;
      const cellD = worksheet.getCell(row, 4);
      
      // CRITICAL: Completely reset formatting from template BEFORE setting value
      const cellDModel = (cellD as any).model;
      if (cellDModel && cellDModel.style && cellDModel.style.font) {
        const oldFont = cellDModel.style.font;
        cellDModel.style.font = {
          size: oldFont.size || 11,
          name: oldFont.name,
          color: oldFont.color,
          bold: false  // Explicitly false
        };
      }
      
      // Clean the text to remove asterisks, special characters, and formatting
      let cleanedText = (item.productService || '').toString();
      // Remove asterisks (markdown bold indicators)
      cleanedText = cleanedText.replace(/\*\*/g, '').replace(/\*/g, '');
      // Remove any zero-width characters or formatting characters
      cleanedText = cleanedText.replace(/[\u200B-\u200D\uFEFF]/g, ''); // Zero-width spaces
      cleanedText = cleanedText.replace(/[\u202A-\u202E]/g, ''); // Directional formatting
      cleanedText = cleanedText.replace(/[\u2060-\u206F]/g, ''); // Word joiner, invisible separator
      // Normalize whitespace
      cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
      
      cellD.value = cleanedText; // Set cleaned value
      
      // Set font explicitly to NOT bold with explicit properties
      cellD.font = { size: 11, bold: false };
      cellD.alignment = { vertical: 'middle', indent: 1, wrapText: true };
      
      // Remove any fill color
      if ((cellD as any).fill) {
        delete (cellD as any).fill;
      }
      
      // Track header row for styling (only if applyFormatting is true)
      if (applyFormatting) {
        headerRows.push({ row, type: 'subcategory' });
      }
      
      // Clear any shared formula reference
      if ((cellD as any).sharedFormula) delete (cellD as any).sharedFormula;
      
      currentRow++;
      
      } else if (item.type === 'item') {
        // Line item row - paste values with NO formatting
        const row = currentRow;
        
        // Clean the text FIRST - remove asterisks, special characters, and formatting
        // Remove any characters that might cause formatting issues
        let cleanedText = (item.productService || '').toString();
        // Remove asterisks (markdown bold indicators)
        cleanedText = cleanedText.replace(/\*\*/g, '').replace(/\*/g, '');
        // Remove any zero-width characters or formatting characters
        cleanedText = cleanedText.replace(/[\u200B-\u200D\uFEFF]/g, ''); // Zero-width spaces
        cleanedText = cleanedText.replace(/[\u202A-\u202E]/g, ''); // Directional formatting
        cleanedText = cleanedText.replace(/[\u2060-\u206F]/g, ''); // Word joiner, invisible separator
        // Remove any rich text formatting characters
        cleanedText = cleanedText.replace(/[\uE000-\uF8FF]/g, ''); // Private use area (sometimes used for formatting)
        // Normalize whitespace
        cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
        
        // Column D: Product/Service description
        const cellD = worksheet.getCell(row, 4);
        const cellE = worksheet.getCell(row, 5);
        
        // CRITICAL ORDER: 
        // 1. Set value FIRST (as plain text)
        // 2. Then set font (this overrides template formatting)
        // 3. Then merge (and re-set font after merge)
        
        // Set value as plain text (no rich text formatting)
        cellD.value = cleanedText;
        
        // NOW set font explicitly - this must come AFTER setting value
        // Use explicit size and bold:false to override template
        cellD.font = { size: 11, bold: false };
        cellE.font = { size: 11, bold: false };
        
        // Merge D:E (check if already merged first)
        try {
          const isMerged = worksheet.model.merges?.some((merge: any) => {
            return merge.top <= row && merge.bottom >= row &&
                   merge.left <= 4 && merge.right >= 5;
          });
          if (!isMerged) {
            worksheet.mergeCells(row, 4, row, 5);
          }
        } catch (e) {
          // Merge might already exist, ignore error
        }
        
        // AFTER merge, FORCE font to not bold
        // Merge can copy formatting from template, so reset it completely
        const mergedCell = worksheet.getCell(row, 4);
        
        // Set font property directly FIRST
        mergedCell.font = { size: 11, bold: false };
        
        // THEN replace model.style.font completely (don't preserve template properties)
        const mergedModel = (mergedCell as any).model;
        if (mergedModel && mergedModel.style) {
          // Create completely new font object - only size and bold:false
          mergedModel.style.font = {
            size: 11,
            bold: false
          };
        }
      
        // Column F: QTY (numeric) - set value and font
        const cellF = worksheet.getCell(row, 6);
        cellF.value = item.qty !== '' && item.qty !== null && item.qty !== undefined ? item.qty : 0;
        cellF.font = { size: 11, bold: false };
        
        // Replace model.style.font completely for F
        const cellFModel = (cellF as any).model;
        if (cellFModel && cellFModel.style) {
          cellFModel.style.font = { size: 11, bold: false };
        }
      
        // Column G: RATE (numeric) - set value and font
        const cellG = worksheet.getCell(row, 7);
        cellG.value = item.rate !== '' && item.rate !== null && item.rate !== undefined ? item.rate : 0;
        cellG.font = { size: 11, bold: false };
        
        // Replace model.style.font completely for G
        const cellGModel = (cellG as any).model;
        if (cellGModel && cellGModel.style) {
          cellGModel.style.font = { size: 11, bold: false };
        }
      
        // Column H: AMOUNT (numeric) - set value and font
        const cellH = worksheet.getCell(row, 8);
        cellH.value = item.amount !== '' && item.amount !== null && item.amount !== undefined ? item.amount : 0;
        cellH.font = { size: 11, bold: false };
        
        // Replace model.style.font completely for H
        const cellHModel = (cellH as any).model;
        if (cellHModel && cellHModel.style) {
          cellHModel.style.font = { size: 11, bold: false };
        }
      
        currentRow++;
    }
  }
  
  // Apply styling to headers/subheaders AFTER all line items are processed
  // This prevents formatting from leaking to other cells
  // Only apply if applyFormatting is true AND we have header rows tracked
  if (applyFormatting && headerRows.length > 0) {
    // Create a Set of header row numbers to quickly check if a row is a header
    const headerRowNumbers = new Set(headerRows.map(hr => hr.row));
    
    for (const headerRow of headerRows) {
      const row = headerRow.row;
      
      // Double-check this is actually a header row (should be, but verify)
      if (!headerRowNumbers.has(row)) {
        continue; // Skip if not in our tracked headers
      }
      
      // Verify this is actually a header row by checking cell D value
      // Since we skip main categories now, only subcategories should be styled
      const cellD = worksheet.getCell(row, 4);
      const cellDValue = cellD.value?.toString() || '';
      
      // Only apply styling to subcategories (main categories are skipped)
      if (headerRow.type !== 'subcategory') {
        continue; // Skip if not a subcategory
      }
      
      // Verify it's actually a subcategory header (has a value)
      if (!cellDValue || cellDValue.trim().length === 0) {
        continue; // Skip if no value
      }
      
      // Apply styling ONLY to columns D through BE (columns 4 through 57) for THIS header row
      for (let col = 4; col <= 57; col++) {
        try {
          const cell = worksheet.getCell(row, col);
          
          // Set fill color: #495568 (ARGB: FF495568)
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF495568' }
          };
          
          // Set font color: white (ARGB: FFFFFFFF) and bold
          cell.font = {
            bold: true,
            color: { argb: 'FFFFFFFF' }
          };
          
          // Maintain alignment only for column D (subcategories only now)
          if (col === 4) {
            cell.alignment = { vertical: 'middle', indent: 1, wrapText: true };
          }
        } catch (e) {
          // Skip cells that don't exist or can't be accessed
        }
      }
    }
  }
  
  // No need to update formulas - template has buffer rows and formulas handle themselves
  // Shared formulas were already cleaned from range 16-465 during load
  
  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
