import ExcelJS from 'exceljs';
import path from 'path';
import XLSXPopulate from 'xlsx-populate';
import { OrderItem, Location } from './tableExtractor';
import { formatLocationHeader, formatSubCategoryHeader, clearCellFormatting } from './cellFormatter';
import { 
  formatSubCategoryHeaderXLSXPopulate, 
  formatLocationHeaderXLSXPopulate,
  clearCellFormattingXLSXPopulate 
} from './xlsxPopulateFormatter';

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
 * Find the last data row in the worksheet (scanning from row 16 up to row 452)
 * Template has maximum usable rows from 17 to 452 for subcategories and line items
 * @param worksheet - Excel worksheet
 * @returns Last row number with data, or 15 if none found
 */
function findLastDataRow(worksheet: ExcelJS.Worksheet): number {
  let lastRow = 15; // Start from row 16 (0-indexed is 15)
  
  // Scan from row 16 to row 452 (maximum usable rows)
  for (let rowNum = 16; rowNum <= 452; rowNum++) {
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
 * This is the "Alternative Quick Fix" - only clean rows 16-452 we'll be working with
 * @param worksheet - Excel worksheet
 * @param startRow - Start row number (default 16)
 * @param endRow - End row number (default 452)
 */
function cleanSharedFormulasFromRange(worksheet: ExcelJS.Worksheet, startRow: number = 16, endRow: number = 452): void {
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
  
  // Clean shared formulas from rows 16-452 (rows we'll be working with)
  // This prevents "Shared Formula master must exist" errors when saving
  cleanSharedFormulasFromRange(worksheet, 16, 452);
  
  // Rename worksheet to "#OrderNo-Street Address"
  const sheetName = sanitizeSheetName(`#${location.orderNo}-${location.streetAddress}`);
  worksheet.name = sheetName;
  
  // Find last data row (scanning up to row 452 - maximum usable rows)
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
    
    // Apply formatting using the formatting component (staggered approach)
    // Only format if applyFormatting is true
    if (applyFormatting) {
      formatLocationHeader(worksheet, 16, 4, 5);
    } else {
      // Basic mode: just set font to not bold (no formatting)
      locationCell.font = { size: 11, bold: false };
      locationCellE.font = { size: 11, bold: false };
      locationCell.alignment = { vertical: 'middle', wrapText: true };
      
      // Reset model.style.font to prevent template inheritance
      if (locationCellModel && locationCellModel.style) {
        locationCellModel.style.font = { size: 11, bold: false };
        if (locationCellModel.style.fill) {
          delete locationCellModel.style.fill;
        }
      }
      if (locationCellEModel && locationCellEModel.style) {
        locationCellEModel.style.font = { size: 11, bold: false };
        if (locationCellEModel.style.fill) {
          delete locationCellEModel.style.fill;
        }
      }
    }
    
    currentRow = 17; // Next row for line items
  }
  
  // Process items and append them
  // STEP 1: Track subcategory row numbers during first pass (ExcelJS)
  // We'll use this list in the second pass (XLSX-Populate) to format ONLY subcategories
  const subcategoryRows: number[] = [];
  let subcategoryCount = 0;
  
  for (const item of items) {
    // SKIP main category headers - user doesn't want them after the main header (row 16)
    if (item.type === 'maincategory') {
      // Just skip main categories - don't write them to the spreadsheet
      continue;
    } else if (item.type === 'subcategory') {
      // Sub-category header row - populate data ONLY (no formatting in first pass)
      const row = currentRow;
      subcategoryCount++;
      
      // TRACK this row as a subcategory for formatting in second pass
      subcategoryRows.push(row);
      console.log(`[First Pass] Tracked subcategory #${subcategoryCount} at row ${row}: "${item.productService?.toString().substring(0, 50)}..."`);
      
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
      
      // Get cells
      const cellD = worksheet.getCell(row, 4);
      const cellE = worksheet.getCell(row, 5);
      const cellF = worksheet.getCell(row, 6);
      const cellG = worksheet.getCell(row, 7);
      const cellH = worksheet.getCell(row, 8);
      
      // Merge D:E FIRST (before setting value)
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
      
      // Set value ONLY (no formatting in first pass)
      cellD.value = cleanedText;
      
      // Explicitly set F, G, H to empty/null for subcategories
      // CRITICAL: Also clear values from columns I through BE (columns 9-57)
      // Subcategory rows serve as visual separators - only D-E should have text
      cellF.value = null;
      cellG.value = null;
      cellH.value = null;
      
      // Clear values from columns I (9) through BE (57) for subcategories
      // These columns should be blank but will have fill color in second pass
      for (let col = 9; col <= 57; col++) {
        try {
          const cell = worksheet.getCell(row, col);
          cell.value = null;
        } catch (e) {
          // Ignore errors for cells that don't exist
        }
      }
      
      // Clear ALL formatting from all cells (D through BE) in first pass
      // Formatting will be applied in second pass using XLSX-Populate
      clearCellFormatting(cellD);
      clearCellFormatting(cellE);
      clearCellFormatting(cellF);
      clearCellFormatting(cellG);
      clearCellFormatting(cellH);
      
      // Also clear formatting from columns I through BE
      for (let col = 9; col <= 57; col++) {
        try {
          const cell = worksheet.getCell(row, col);
          clearCellFormatting(cell);
        } catch (e) {
          // Ignore errors
        }
      }
      
      // Set basic alignment for column D (without formatting)
      cellD.alignment = { vertical: 'middle', indent: 1, wrapText: true };
      
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
        
        // CRITICAL: Clear formatting FIRST before setting any values
        // This prevents template formatting from being inherited
        // Line items should have NO formatting (no fill, no bold, no color)
        
        // Get all cells for this row
        const cellD = worksheet.getCell(row, 4);
        const cellE = worksheet.getCell(row, 5);
        const cellF = worksheet.getCell(row, 6);
        const cellG = worksheet.getCell(row, 7);
        const cellH = worksheet.getCell(row, 8);
        
        // CRITICAL: Line items should NEVER have formatting (no fill, no bold, no color)
        // Clear formatting MULTIPLE times to ensure template formatting is completely removed
        
        // STEP 1: Clear formatting from ALL cells FIRST (before setting values)
        clearCellFormatting(cellD);
        clearCellFormatting(cellE);
        clearCellFormatting(cellF);
        clearCellFormatting(cellG);
        clearCellFormatting(cellH);
        
        // STEP 2: Set values
        cellD.value = cleanedText;
        cellF.value = item.qty !== '' && item.qty !== null && item.qty !== undefined ? item.qty : 0;
        cellG.value = item.rate !== '' && item.rate !== null && item.rate !== undefined ? item.rate : 0;
        cellH.value = item.amount !== '' && item.amount !== null && item.amount !== undefined ? item.amount : 0;
        
        // STEP 3: After setting values, clear formatting AGAIN
        // Setting values can sometimes re-apply template formatting in ExcelJS
        clearCellFormatting(cellD);
        clearCellFormatting(cellE);
        clearCellFormatting(cellF);
        clearCellFormatting(cellG);
        clearCellFormatting(cellH);
        
        // STEP 4: Merge D:E AFTER clearing formatting and setting values
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
        
        // STEP 5: After merge, clear formatting AGAIN (merge can copy formatting)
        const mergedCell = worksheet.getCell(row, 4);
        clearCellFormatting(mergedCell);
        clearCellFormatting(cellE); // Also clear E explicitly
        clearCellFormatting(cellF);
        clearCellFormatting(cellG);
        clearCellFormatting(cellH);
        
        // STEP 6: Final verification - explicitly set font and fill to ensure no formatting
        // This is the last line of defense
        mergedCell.font = { size: 11, bold: false };
        try {
          (mergedCell as any).fill = null;
          delete (mergedCell as any).fill;
        } catch (e) {
          // Ignore errors
        }
        
        cellF.font = { size: 11, bold: false };
        try {
          (cellF as any).fill = null;
          delete (cellF as any).fill;
        } catch (e) {
          // Ignore errors
        }
        
        cellG.font = { size: 11, bold: false };
        try {
          (cellG as any).fill = null;
          delete (cellG as any).fill;
        } catch (e) {
          // Ignore errors
        }
        
        cellH.font = { size: 11, bold: false };
        try {
          (cellH as any).fill = null;
          delete (cellH as any).fill;
        } catch (e) {
          // Ignore errors
        }
      
        currentRow++;
    }
  }
  
  console.log(`[First Pass] Total subcategories tracked: ${subcategoryCount} (rows: ${subcategoryRows.join(', ')})`);
  console.log(`[First Pass] Current row after processing: ${currentRow}`);
  
  // STEP 2: Generate initial buffer WITHOUT formatting
  // We'll apply formatting in second pass using XLSX-Populate (better at preserving styles)
  const initialBuffer = await workbook.xlsx.writeBuffer();
  console.log(`[First Pass] Generated initial buffer: ${initialBuffer.byteLength} bytes`);
  
  // Verify buffer was generated successfully
  if (!initialBuffer || initialBuffer.byteLength === 0) {
    throw new Error('Failed to generate buffer');
  }
  
  // STEP 3: If formatting is requested, use XLSX-Populate for second pass formatting
  // XLSX-Populate is better at preserving and applying formatting when reading/writing buffers
  if (applyFormatting) {
    // Load the buffer into XLSX-Populate workbook
    const formattedWorkbook = await XLSXPopulate.fromDataAsync(initialBuffer);
    
    // Get the worksheet by name
    const formattedWorksheet = formattedWorkbook.sheet(sheetName);
    
    if (!formattedWorksheet) {
      throw new Error(`Worksheet "${sheetName}" not found`);
    }
    
    // STEP 4: Apply formatting to location header (Row 16) using XLSX-Populate
    const row16CellD = formattedWorksheet.cell(16, 4);
    const row16Value = row16CellD.value();
    if (row16Value && row16Value.toString().includes('Pool & Spa')) {
      // Apply formatting to location header using XLSX-Populate
      // This function will handle merging D:E internally
      await formatLocationHeaderXLSXPopulate(formattedWorkbook, sheetName, 16, 4, 5);
    }
    
    // STEP 5: Apply formatting ONLY to tracked subcategory rows
    // We know exactly which rows are subcategories from the first pass
    // This is more reliable than trying to infer from cell values
    console.log(`[Formatting] Starting formatting phase...`);
    console.log(`[Formatting] Total subcategory rows to format: ${subcategoryRows.length}`);
    console.log(`[Formatting] Subcategory rows: ${subcategoryRows.join(', ')}`);
    
    let formattedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Process ALL subcategory rows - don't stop on errors
    for (let i = 0; i < subcategoryRows.length; i++) {
      const rowNum = subcategoryRows[i];
      try {
        // Verify the row exists and has data before formatting
        const cellD = formattedWorksheet.cell(rowNum, 4);
        const cellDValue = cellD.value();
        
        // Only format if the cell has a value (it's a subcategory)
        if (cellDValue && cellDValue.toString().trim().length > 0) {
          const preview = cellDValue.toString().substring(0, 50);
          console.log(`[Formatting] [${i + 1}/${subcategoryRows.length}] Formatting row ${rowNum}: "${preview}..."`);
          
          // Apply formatting to subcategory header using XLSX-Populate
          // This function will format columns D-BE (4-57) with fill color
          // Columns D-E will have text with white font, columns F-BE will be blank with fill color
          await formatSubCategoryHeaderXLSXPopulate(formattedWorkbook, sheetName, rowNum, 4, 57);
          
          formattedCount++;
          console.log(`[Formatting] ✓ Successfully formatted row ${rowNum} (${formattedCount} total)`);
        } else {
          skippedCount++;
          console.warn(`[Formatting] ⚠ Skipping row ${rowNum} - no value in cell D (empty or null)`);
        }
      } catch (error) {
        errorCount++;
        // Log error but continue processing other rows - CRITICAL for processing all rows
        console.error(`[Formatting] ✗ Error formatting row ${rowNum} (${errorCount} errors):`, error);
        // Continue to next row instead of stopping - we want to format ALL rows
      }
    }
    
    console.log(`[Formatting] Completed formatting phase:`);
    console.log(`[Formatting]   - Formatted: ${formattedCount} rows`);
    console.log(`[Formatting]   - Skipped: ${skippedCount} rows`);
    console.log(`[Formatting]   - Errors: ${errorCount} rows`);
    console.log(`[Formatting]   - Total processed: ${formattedCount + skippedCount + errorCount} / ${subcategoryRows.length} rows`);
    
    // STEP 6: Generate final buffer with formatting applied using XLSX-Populate
    // XLSX-Populate should preserve formatting better than ExcelJS when writing
    console.log(`[Formatting] Generating final buffer with formatting...`);
    const formattedBuffer = await formattedWorkbook.outputAsync();
    
    // Verify buffer was generated successfully
    if (!formattedBuffer || formattedBuffer.byteLength === 0) {
      throw new Error('Failed to generate formatted buffer');
    }
    
    console.log(`[Formatting] Generated formatted buffer: ${formattedBuffer.byteLength} bytes`);
    console.log(`[Formatting] Formatting complete! Processed ${formattedCount} subcategory rows.`);
    
    // Convert to Node.js Buffer (XLSX-Populate returns ArrayBuffer-like, convert to Buffer)
    return Buffer.from(formattedBuffer);
  }
  
  // No need to update formulas - template has buffer rows and formulas handle themselves
  // Shared formulas were already cleaned from range 16-452 during load
  
  // CRITICAL: Return the final buffer (with formatting if applyFormatting was true)
  // This is the output after all processing is complete
  return Buffer.from(initialBuffer);
}
