import ExcelJS from 'exceljs';
import path from 'path';
import XLSXPopulate from 'xlsx-populate';
import { OrderItem, Location } from './tableExtractor';
import { formatLocationHeader, formatSubCategoryHeader, clearCellFormatting } from './cellFormatter';
import { 
  formatSubCategoryHeaderXLSXPopulate, 
  formatLocationHeaderXLSXPopulate,
  formatColumnsAAndOWhite,
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
 * Delete unused rows from a buffer (third pass)
 * This function loads the buffer, deletes rows, and returns a new buffer
 * This is done as a separate pass AFTER formatting to avoid breaking shared formulas
 * @param buffer - Excel file buffer
 * @param sheetName - Name of the worksheet
 * @param lastDataRow - Last row number that contains data
 * @param maxRow - Maximum row number (452)
 * @param bufferRows - Number of buffer rows to keep (15)
 * @returns New buffer with rows deleted
 */
async function deleteUnusedRowsFromBuffer(
  buffer: Buffer,
  sheetName: string,
  lastDataRow: number,
  maxRow: number = 452,
  bufferRows: number = 15
): Promise<Buffer> {
  try {
    // Load the buffer into ExcelJS workbook
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    
    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) {
      console.warn(`[Row Cleanup] Worksheet "${sheetName}" not found, returning original buffer`);
      return buffer;
    }
    
    // CRITICAL: Clean ALL shared formulas in the entire worksheet BEFORE deletion
    // This prevents broken references after rows are deleted and shifted
    console.log(`[Row Cleanup] Cleaning ALL shared formulas before row deletion...`);
    try {
      // Clean from row 1 to a high row number to catch all shared formulas
      cleanSharedFormulasFromRange(worksheet, 1, 1000);
      console.log(`[Row Cleanup] All shared formulas cleaned before deletion`);
    } catch (cleanError: any) {
      console.warn(`[Row Cleanup] Warning: Could not clean shared formulas before deletion:`, cleanError?.message || cleanError);
      // Continue anyway - we'll try to delete rows
    }
    
    // Call the row deletion logic
    const rowsDeleted = deleteUnusedRows(worksheet, lastDataRow, maxRow, bufferRows);
    
    if (!rowsDeleted) {
      console.log(`[Row Cleanup] No rows were deleted, returning original buffer`);
      return buffer;
    }
    
    // CRITICAL: After deleting rows, clean shared formulas again from remaining rows
    // Row deletion shifts rows up, which can break formula references
    // Clean from row 1 to the new maximum row (after deletion)
    const newMaxRow = lastDataRow + bufferRows; // After deletion, max row should be lastDataRow + bufferRows
    console.log(`[Row Cleanup] Cleaning shared formulas after row deletion (rows 1-${newMaxRow})...`);
    try {
      cleanSharedFormulasFromRange(worksheet, 1, newMaxRow + 50); // Add buffer for safety
      console.log(`[Row Cleanup] Shared formulas cleaned after deletion`);
    } catch (cleanError: any) {
      console.warn(`[Row Cleanup] Warning: Could not clean shared formulas after deletion:`, cleanError?.message || cleanError);
      // Continue anyway - we'll try to write the buffer
    }
    
    // CRITICAL: Also clear all shared formula definitions from worksheet model
    // This is a more aggressive approach that removes all shared formula references
    try {
      if (worksheet.model && (worksheet.model as any).sharedFormulas) {
        console.log(`[Row Cleanup] Clearing all shared formula definitions from worksheet model...`);
        (worksheet.model as any).sharedFormulas = {};
        console.log(`[Row Cleanup] All shared formula definitions cleared from model`);
      }
    } catch (modelError: any) {
      console.warn(`[Row Cleanup] Warning: Could not clear shared formulas from model:`, modelError?.message || modelError);
    }
    
    // Generate new buffer with rows deleted
    console.log(`[Row Cleanup] Writing buffer after row deletion...`);
    try {
      const newBuffer = await workbook.xlsx.writeBuffer();
      console.log(`[Row Cleanup] Buffer written successfully: ${newBuffer.byteLength} bytes`);
      return Buffer.from(newBuffer);
    } catch (writeError: any) {
      console.error(`[Row Cleanup] Error writing buffer after row deletion:`, writeError?.message || writeError);
      console.error(`[Row Cleanup] Stack trace:`, writeError?.stack || 'No stack trace');
      // If writing fails, try one more aggressive cleanup
      console.log(`[Row Cleanup] Attempting aggressive shared formula cleanup...`);
      try {
        // Clear ALL shared formulas from the entire worksheet
        if (worksheet.model) {
          (worksheet.model as any).sharedFormulas = {};
        }
        // Also clear from all cells
        for (let rowNum = 1; rowNum <= newMaxRow + 100; rowNum++) {
          for (let colNum = 1; colNum <= 100; colNum++) {
            try {
              const cell = worksheet.getCell(rowNum, colNum);
              const cellValue = cell.value;
              if (cellValue && typeof cellValue === 'object' && !Array.isArray(cellValue)) {
                const valueObj = cellValue as any;
                if (valueObj.sharedFormula) {
                  // Remove shared formula reference - convert to null or keep existing value
                  if (cell.formula) {
                    cell.value = { formula: cell.formula };
                  } else {
                    // Clear the cell if it has a shared formula but no formula string
                    cell.value = null;
                  }
                }
              }
              // Also clear sharedFormula property directly
              if ((cell as any).sharedFormula) {
                delete (cell as any).sharedFormula;
              }
            } catch (e) {
              // Ignore errors
            }
          }
        }
        // Try writing again
        const newBuffer = await workbook.xlsx.writeBuffer();
        console.log(`[Row Cleanup] Buffer written successfully after aggressive cleanup: ${newBuffer.byteLength} bytes`);
        return Buffer.from(newBuffer);
      } catch (retryError: any) {
        console.error(`[Row Cleanup] Failed to write buffer even after aggressive cleanup:`, retryError?.message || retryError);
        throw retryError; // Re-throw to be caught by outer catch
      }
    }
  } catch (error: any) {
    console.error(`[Row Cleanup] Error during row deletion from buffer:`, error?.message || error);
    console.error(`[Row Cleanup] Stack trace:`, error?.stack || 'No stack trace');
    // Return original buffer if deletion fails - row deletion is not critical
    console.warn(`[Row Cleanup] Returning original buffer due to error`);
    return buffer;
  }
}

/**
 * Delete unused rows between last data row and row 452, leaving 15 buffer rows
 * This makes the output cleaner while still allowing some extra rows for manual edits
 * @param worksheet - Excel worksheet
 * @param lastDataRow - Last row number that contains data
 * @param maxRow - Maximum row number (452)
 * @param bufferRows - Number of buffer rows to keep (15)
 */
function deleteUnusedRows(
  worksheet: ExcelJS.Worksheet,
  lastDataRow: number,
  maxRow: number = 452,
  bufferRows: number = 15
): boolean {
  try {
    // Validate inputs
    if (!worksheet) {
      console.warn(`[Row Cleanup] Worksheet is undefined, skipping row deletion`);
      return false;
    }
    
    if (lastDataRow < 16) {
      console.log(`[Row Cleanup] Last data row (${lastDataRow}) is before row 16, skipping deletion`);
      return false;
    }
    
    // Calculate rows to keep and delete
    // Example: If lastDataRow is 100, we want to keep 15 buffer rows after it (rows 101-115)
    // Then delete all remaining empty rows up to row 452
    // After deletion, we'll have: data rows (up to 100) + 15 buffer rows (101-115)
    const firstRowToKeep = lastDataRow + 1; // First buffer row after data
    const lastRowToKeep = lastDataRow + bufferRows; // Last buffer row to keep (e.g., 100 + 15 = 115)
    
    // Calculate the first row to delete (after the buffer rows we want to keep)
    const firstRowToDelete = lastRowToKeep + 1; // e.g., 115 + 1 = 116
    
    // Calculate the last row we can safely delete (maxRow)
    // We want to delete all rows from firstRowToDelete to maxRow
    // After deletion, we'll have exactly bufferRows buffer rows after the last data row
    const lastRowToDelete = maxRow;
    
    // If we've already used all available rows (lastDataRow + bufferRows >= maxRow), no deletion needed
    if (lastRowToKeep >= maxRow) {
      console.log(`[Row Cleanup] No rows to delete. Last data row: ${lastDataRow}, Buffer rows extend to row ${lastRowToKeep}, Max row: ${maxRow}`);
      return false;
    }
    
    // Validate that firstRowToDelete is within bounds
    if (firstRowToDelete > maxRow) {
      console.log(`[Row Cleanup] First row to delete (${firstRowToDelete}) is beyond max row (${maxRow}), skipping deletion`);
      return false;
    }
    
    // Calculate number of rows to delete
    const rowsToDelete = Math.max(0, lastRowToDelete - firstRowToDelete + 1); // e.g., 452 - 116 + 1 = 337
    
    if (rowsToDelete <= 0) {
      console.log(`[Row Cleanup] No rows to delete (rowsToDelete: ${rowsToDelete})`);
      return false;
    }
    
    console.log(`[Row Cleanup] Plan: Delete ${rowsToDelete} rows from row ${firstRowToDelete} to ${lastRowToDelete}`);
    console.log(`[Row Cleanup] Last data row: ${lastDataRow}`);
    console.log(`[Row Cleanup] Will keep ${bufferRows} buffer rows after data: rows ${firstRowToKeep} to ${lastRowToKeep}`);
    console.log(`[Row Cleanup] After deletion, we'll have exactly ${bufferRows} buffer rows after the last data row`);
    
    // Delete rows using ExcelJS spliceRows method
    // ExcelJS spliceRows(start, count) deletes 'count' rows starting from 'start' (1-indexed)
    // After deletion, all rows below shift up
    // We verify rows are empty before deleting to avoid deleting rows with data or formulas
    
    // First, verify that rows from firstRowToDelete to lastRowToDelete are empty
    // Check columns D-H (our working columns) to ensure they don't have data
    let allRowsEmpty = true;
    for (let rowToCheck = firstRowToDelete; rowToCheck <= lastRowToDelete; rowToCheck++) {
      // Check if row has any data in columns D-H (our working columns)
      // We're checking D-H because those are the columns we populate
      for (let col = 4; col <= 8; col++) {
        try {
          const cell = worksheet.getCell(rowToCheck, col);
          const cellValue = cell.value;
          
          // If cell has a value that's not empty/null/zero, don't delete
          if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
            if (typeof cellValue === 'string' && cellValue.trim().length > 0) {
              allRowsEmpty = false;
              console.log(`[Row Cleanup] Row ${rowToCheck} has data in column ${col}: "${cellValue.toString().substring(0, 50)}"`);
              break;
            } else if (typeof cellValue === 'number' && cellValue !== 0) {
              allRowsEmpty = false;
              console.log(`[Row Cleanup] Row ${rowToCheck} has data in column ${col}: ${cellValue}`);
              break;
            }
          }
        } catch (e) {
          // Ignore errors for cells that don't exist
        }
      }
      if (!allRowsEmpty) break;
    }
    
    if (allRowsEmpty && rowsToDelete > 0) {
      // All rows are empty - delete them all at once (more efficient)
      try {
        console.log(`[Row Cleanup] All ${rowsToDelete} rows are empty. Deleting in one batch...`);
        
        // Verify spliceRows method exists before calling it
        if (typeof worksheet.spliceRows !== 'function') {
          console.warn(`[Row Cleanup] spliceRows method not available, skipping row deletion`);
          return false;
        }
        
        // Call spliceRows with validation
        worksheet.spliceRows(firstRowToDelete, rowsToDelete);
        console.log(`[Row Cleanup] Successfully deleted ${rowsToDelete} rows (rows ${firstRowToDelete}-${lastRowToDelete})`);
        console.log(`[Row Cleanup] Final result: ${bufferRows} buffer rows after last data row (rows ${firstRowToKeep}-${lastRowToKeep})`);
        return true; // Successfully deleted rows
      } catch (error: any) {
        console.error(`[Row Cleanup] Error deleting rows in batch:`, error?.message || error);
        console.error(`[Row Cleanup] Stack trace:`, error?.stack || 'No stack trace');
        // Don't use fallback - if batch deletion fails, return false
        console.log(`[Row Cleanup] Skipping row deletion due to error`);
        return false;
      }
    } else if (!allRowsEmpty) {
      console.log(`[Row Cleanup] Cannot delete rows - some rows contain data. Keeping all rows.`);
      return false;
    } else {
      console.log(`[Row Cleanup] No rows to delete`);
      return false;
    }
  } catch (error: any) {
    // Log error but don't fail the entire process
    console.error(`[Row Cleanup] Error during row deletion:`, error?.message || error);
    // Return false to indicate deletion failed
    return false;
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
  
  // Store the last data row for row deletion in third pass
  const lastDataRowAfterProcessing = currentRow - 1; // currentRow is the next row to write
  
  // STEP 2: Generate initial buffer WITHOUT formatting
  // We'll apply formatting in second pass using XLSX-Populate (better at preserving styles)
  // Row deletion will happen in third pass to avoid breaking shared formulas
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
    
    // STEP 6: Format columns A and O with white fill color
    // This applies white fill to entire columns A and O
    // Format from row 1 to row 452 (maximum usable rows) to ensure all rows are covered
    console.log(`[Formatting] Formatting columns A and O with white fill...`);
    try {
      // Format from row 1 to row 452 (maxRow) to cover all rows in the worksheet
      // This ensures columns A and O have white fill throughout the entire data area
      await formatColumnsAAndOWhite(formattedWorkbook, sheetName, 1, 452);
      console.log(`[Formatting] Successfully formatted columns A and O (rows 1-452) with white fill`);
    } catch (columnFormatError: any) {
      console.warn(`[Formatting] Warning: Could not format columns A and O:`, columnFormatError?.message || columnFormatError);
      // Continue anyway - column formatting is not critical
    }
    
    // STEP 7: Generate final buffer with formatting applied using XLSX-Populate
    // XLSX-Populate should preserve formatting better than ExcelJS when writing
    console.log(`[Formatting] Generating final buffer with formatting...`);
    const formattedBuffer = await formattedWorkbook.outputAsync();
    
    // Verify buffer was generated successfully
    if (!formattedBuffer || formattedBuffer.byteLength === 0) {
      throw new Error('Failed to generate formatted buffer');
    }
    
    console.log(`[Formatting] Generated formatted buffer: ${formattedBuffer.byteLength} bytes`);
    console.log(`[Formatting] Formatting complete! Processed ${formattedCount} subcategory rows.`);
    
    // STEP 8: Third pass - Delete unused rows AFTER formatting is complete
    // This prevents breaking shared formula references during formatting
    console.log(`[Row Cleanup] Starting third pass - row deletion...`);
    const formattedBufferNode = Buffer.from(formattedBuffer);
    const finalBuffer = await deleteUnusedRowsFromBuffer(
      formattedBufferNode,
      sheetName,
      lastDataRowAfterProcessing,
      452,
      15
    );
    
    console.log(`[Row Cleanup] Row deletion complete. Final buffer: ${finalBuffer.byteLength} bytes`);
    return finalBuffer;
  }
  
  // STEP 3: If no formatting, still do row deletion as third pass
  // This ensures consistent behavior regardless of formatting option
  console.log(`[Row Cleanup] Starting third pass - row deletion (no formatting applied)...`);
  const initialBufferNode = Buffer.from(initialBuffer);
  const finalBuffer = await deleteUnusedRowsFromBuffer(
    initialBufferNode,
    sheetName,
    lastDataRowAfterProcessing,
    452,
    15
  );
  
  console.log(`[Row Cleanup] Row deletion complete. Final buffer: ${finalBuffer.byteLength} bytes`);
  
  // No need to update formulas - template has buffer rows and formulas handle themselves
  // Shared formulas were already cleaned from range 16-452 during load
  
  // CRITICAL: Return the final buffer after row deletion
  // This is the output after all processing is complete
  return finalBuffer;
}
