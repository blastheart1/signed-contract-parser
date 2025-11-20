import ExcelJS from 'exceljs';
import path from 'path';
import { OrderItem, Location } from './tableExtractor';
import { AddendumData } from './addendumParser';
import { db } from '@/lib/db';
import { invoices } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

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
 * Find the last data row in the worksheet (scanning from row 16 up to row 339)
 * Template has maximum usable rows from 17 to 339 for subcategories and line items
 * @param worksheet - Excel worksheet
 * @returns Last row number with data, or 15 if none found
 */
function findLastDataRow(worksheet: ExcelJS.Worksheet): number {
  let lastRow = 15; // Start from row 16 (0-indexed is 15)
  
  // Scan from row 16 to row 339 (maximum usable rows)
  for (let rowNum = 16; rowNum <= 339; rowNum++) {
    // Check column A first - if it has a label, it's a data row
    const cellA = worksheet.getCell(rowNum, 1);
    const cellAValue = cellA.value;
    
    // Skip rows that are marked as blank rows (these shouldn't count as data)
    if (cellAValue === '1 - Blank Row') {
      continue;
    }
    
    // Check if this row has actual data content in columns D, F, G, or H
    const cellD = worksheet.getCell(rowNum, 4); // Column D
    const cellF = worksheet.getCell(rowNum, 6); // Column F
    const cellG = worksheet.getCell(rowNum, 7); // Column G
    const cellH = worksheet.getCell(rowNum, 8); // Column H
    
    // Check if row has meaningful data (not just empty strings or formulas evaluating to empty)
    const hasData = 
      (cellAValue && cellAValue !== '1 - Blank Row') || // Has label in A (Header, Subheader, Detail)
      (cellD.value && cellD.value.toString().trim().length > 0) || // Has text in D
      (cellF.value && typeof cellF.value === 'number' && cellF.value !== 0) || // Has non-zero number in F
      (cellG.value && typeof cellG.value === 'number' && cellG.value !== 0) || // Has non-zero number in G
      (cellH.value && typeof cellH.value === 'number' && cellH.value !== 0); // Has non-zero number in H
    
    if (hasData) {
      lastRow = rowNum;
    }
  }
  
  return lastRow;
}


/**
 * Clean shared formulas from worksheet to prevent cloning errors
 * Converts shared formulas to regular formulas for rows that might be affected
 * This is the "Alternative Quick Fix" - only clean rows 16-339 we'll be working with
 * @param worksheet - Excel worksheet
 * @param startRow - Start row number (default 16)
 * @param endRow - End row number (default 339)
 */
function cleanSharedFormulasFromRange(worksheet: ExcelJS.Worksheet, startRow: number = 16, endRow: number = 339): void {
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
 * Delete rows after end marker (Pass 2)
 * Simple, straightforward deletion: delete all rows from (endMarkerRow + 1) to maxRow
 * Deletes from bottom to top to avoid index shifting issues
 * @param buffer - Excel file buffer from Pass 1
 * @param sheetName - Name of the worksheet
 * @param endMarkerRow - Row number of the end marker (Column B = "Last Row")
 * @param maxRow - Maximum row number to delete up to (338)
 * @returns New buffer with rows deleted
 */
async function deleteRowsAfterMarker(
  buffer: Buffer,
  sheetName: string,
  endMarkerRow: number,
  maxRow: number = 338
): Promise<Buffer> {
  try {
    // Load the buffer into ExcelJS workbook
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    
    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) {
      console.warn(`[Pass 2] Worksheet "${sheetName}" not found, returning original buffer`);
      return buffer;
    }
    
    // Verify end marker row by checking Column B for "Last Row"
    let foundMarkerRow = endMarkerRow;
    try {
      const markerCellB = worksheet.getCell(endMarkerRow, 2);
      if (markerCellB.value !== 'Last Row') {
        console.warn(`[Pass 2] End marker not found at row ${endMarkerRow} (Column B = "${markerCellB.value}"), searching...`);
        // Search for the marker row
        for (let row = 16; row <= maxRow; row++) {
          const cellB = worksheet.getCell(row, 2);
          if (cellB.value === 'Last Row') {
            foundMarkerRow = row;
            console.log(`[Pass 2] Found end marker at row ${foundMarkerRow}`);
            break;
          }
        }
      }
    } catch (e) {
      console.warn(`[Pass 2] Could not verify end marker row, using provided row ${endMarkerRow}`);
    }
    
    // Calculate rows to delete: from (foundMarkerRow + 1) to maxRow
    const firstRowToDelete = foundMarkerRow + 1;
    const lastRowToDelete = maxRow;
    
    // Check if there are any rows to delete
    if (firstRowToDelete > lastRowToDelete) {
      console.log(`[Pass 2] No rows to delete (marker at row ${foundMarkerRow}, max row is ${maxRow})`);
      return buffer;
    }
    
    const rowsToDelete = lastRowToDelete - firstRowToDelete + 1;
    console.log(`[Pass 2] Will delete ${rowsToDelete} rows: rows ${firstRowToDelete} to ${lastRowToDelete}`);
    
    // CRITICAL: Clean ALL shared formulas BEFORE deletion
    // This prevents orphaned references when rows are deleted
    console.log(`[Pass 2] Cleaning all shared formulas before row deletion...`);
    try {
      // Clean shared formulas from the entire worksheet (rows 1 to a high number)
      cleanSharedFormulasFromRange(worksheet, 1, 1000);
      
      // Also clear all shared formula definitions from worksheet model
      if (worksheet.model && (worksheet.model as any).sharedFormulas) {
        console.log(`[Pass 2] Clearing all shared formula definitions from worksheet model before deletion...`);
        (worksheet.model as any).sharedFormulas = {};
      }
      
      console.log(`[Pass 2] Shared formulas cleaned before deletion`);
    } catch (cleanError: any) {
      console.warn(`[Pass 2] Warning: Could not clean shared formulas before deletion:`, cleanError?.message || cleanError);
      // Continue anyway - we'll try to delete rows
    }
    
    // Delete rows from bottom to top (simple, straightforward - like user would do)
    // This avoids index shifting issues
    let deletedCount = 0;
    for (let rowToDelete = lastRowToDelete; rowToDelete >= firstRowToDelete; rowToDelete--) {
      try {
        // Verify spliceRows method exists
        if (typeof worksheet.spliceRows !== 'function') {
          console.error(`[Pass 2] spliceRows method not available, cannot delete rows`);
          throw new Error('spliceRows method not available');
        }
        
        // Delete one row at a time (more reliable than batch deletion)
        worksheet.spliceRows(rowToDelete, 1);
        deletedCount++;
      } catch (error: any) {
        console.warn(`[Pass 2] Could not delete row ${rowToDelete}:`, error?.message || error);
        // Continue with other rows
      }
    }
    
    console.log(`[Pass 2] Successfully deleted ${deletedCount} out of ${rowsToDelete} rows`);
    
    // CRITICAL: Clean ALL shared formulas AFTER deletion, before writing buffer
    // Row deletion can leave orphaned shared formula references
    // We need to clean the entire worksheet to prevent "Shared Formula master must exist" errors
    console.log(`[Pass 2] Cleaning all shared formulas after row deletion...`);
    try {
      // First, clear all shared formula definitions from worksheet model
      if (worksheet.model && (worksheet.model as any).sharedFormulas) {
        console.log(`[Pass 2] Clearing all shared formula definitions from worksheet model...`);
        (worksheet.model as any).sharedFormulas = {};
      }
      
      // Clean shared formulas from the entire worksheet (rows 1 to a high number)
      // Check up to row 1000 to catch any formulas beyond our data area
      cleanSharedFormulasFromRange(worksheet, 1, 1000);
      
      // Also iterate through all rows in the worksheet model if available
      // This catches shared formulas that might be in the model but not accessible via getCell
      if (worksheet.model && (worksheet.model as any).rows) {
        console.log(`[Pass 2] Cleaning shared formulas from worksheet model rows...`);
        const rows = (worksheet.model as any).rows;
        if (Array.isArray(rows)) {
          rows.forEach((row: any, rowIndex: number) => {
            if (row && row.cells) {
              Object.values(row.cells).forEach((cell: any) => {
                if (cell && cell.value && typeof cell.value === 'object' && cell.value.sharedFormula) {
                  if (cell.formula) {
                    cell.value = { formula: cell.formula };
                  } else {
                    cell.value = null;
                  }
                }
                if (cell && cell.sharedFormula) {
                  delete cell.sharedFormula;
                }
              });
            }
          });
        }
      }
      
      console.log(`[Pass 2] Shared formulas cleaned successfully`);
    } catch (cleanError: any) {
      console.warn(`[Pass 2] Warning: Could not clean shared formulas after deletion:`, cleanError?.message || cleanError);
      // Continue anyway - we'll try to write the buffer
    }
    
    // Generate final buffer
    console.log(`[Pass 2] Generating final buffer...`);
    try {
      const finalBuffer = await workbook.xlsx.writeBuffer();
      console.log(`[Pass 2] Final buffer generated: ${finalBuffer.byteLength} bytes`);
      return Buffer.from(finalBuffer);
    } catch (writeError: any) {
      console.error(`[Pass 2] Error writing buffer:`, writeError?.message || writeError);
      
      // If writing fails due to shared formulas, try aggressive cleanup
      console.log(`[Pass 2] Attempting aggressive shared formula cleanup...`);
      try {
        // Clear ALL shared formulas from worksheet model first
        if (worksheet.model) {
          (worksheet.model as any).sharedFormulas = {};
          console.log(`[Pass 2] Cleared shared formulas from model`);
        }
        
        // Get the actual row count from the worksheet
        // ExcelJS might have rows beyond what rowCount reports, so check a high number
        const actualRowCount = worksheet.rowCount || 1000;
        const maxRowToCheck = Math.max(actualRowCount, 1000, 900); // Check at least up to row 900 (error was at 832)
        console.log(`[Pass 2] Checking all rows (1-${maxRowToCheck}) for shared formulas...`);
        
        // Check ALL rows in the worksheet (not just up to marker)
        // The error shows row 832, so we need to check all rows
        for (let rowNum = 1; rowNum <= maxRowToCheck; rowNum++) {
          for (let colNum = 1; colNum <= 200; colNum++) { // Check up to column 200 (BS is column 71, but check more)
            try {
              const cell = worksheet.getCell(rowNum, colNum);
              
              // Check if cell has shared formula in value object
              const cellValue = cell.value;
              if (cellValue && typeof cellValue === 'object' && !Array.isArray(cellValue)) {
                const valueObj = cellValue as any;
                if (valueObj.sharedFormula) {
                  // Convert to regular formula if available
                  if (cell.formula) {
                    cell.value = { formula: cell.formula };
                  } else {
                    // No formula available, clear the cell
                    cell.value = null;
                  }
                }
              }
              
              // Also check and clear sharedFormula property directly on cell
              if ((cell as any).sharedFormula) {
                delete (cell as any).sharedFormula;
              }
              
              // Also check the cell model directly
              const cellModel = (cell as any).model;
              if (cellModel) {
                if (cellModel.sharedFormula) {
                  delete cellModel.sharedFormula;
                }
                if (cellModel.value && typeof cellModel.value === 'object' && cellModel.value.sharedFormula) {
                  if (cellModel.formula) {
                    cellModel.value = { formula: cellModel.formula };
                  } else {
                    cellModel.value = null;
                  }
                }
              }
            } catch (e) {
              // Ignore errors for cells that don't exist
            }
          }
        }
        
        // Clear shared formulas from model one more time
        if (worksheet.model) {
          (worksheet.model as any).sharedFormulas = {};
        }
        
        console.log(`[Pass 2] Aggressive cleanup complete, attempting to write buffer...`);
        
        // Try writing again
        const finalBuffer = await workbook.xlsx.writeBuffer();
        console.log(`[Pass 2] Final buffer generated after aggressive cleanup: ${finalBuffer.byteLength} bytes`);
        return Buffer.from(finalBuffer);
      } catch (retryError: any) {
        console.error(`[Pass 2] Failed to write buffer even after aggressive cleanup:`, retryError?.message || retryError);
        // If even aggressive cleanup fails, return the original buffer (without deletion)
        // This ensures the file is still generated, just with extra rows
        // The end marker is still in place, so users can see where data ends
        console.warn(`[Pass 2] Returning original buffer (rows not deleted) due to persistent shared formula errors`);
        console.warn(`[Pass 2] Note: End marker is still in place at row ${foundMarkerRow} (Column B = "Last Row")`);
        return buffer;
      }
    }
  } catch (error: any) {
    console.error(`[Pass 2] Error during row deletion:`, error?.message || error);
    console.error(`[Pass 2] Stack trace:`, error?.stack || 'No stack trace');
    // Return original buffer if deletion fails - deletion is not critical
    console.warn(`[Pass 2] Returning original buffer due to error`);
    return buffer;
  }
}

/**
 * Delete unused rows between last data row and maxRow, leaving 15 buffer rows
 * This makes the output cleaner while still allowing some extra rows for manual edits
 * @param worksheet - Excel worksheet
 * @param lastDataRow - Last row number that contains data
 * @param maxRow - Maximum row number (339 for Template-V2, 452 for template.xlsx)
 * @param bufferRows - Number of buffer rows to keep (15)
 */
function deleteUnusedRows(
  worksheet: ExcelJS.Worksheet,
  lastDataRow: number,
  maxRow: number = 339,
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
    // Check columns A, D-H to ensure they don't have data
    let allRowsEmpty = true;
    for (let rowToCheck = firstRowToDelete; rowToCheck <= lastRowToDelete; rowToCheck++) {
      try {
        // Check column A - if it has a label (not "1 - Blank Row" which we'll add later), don't delete
        const cellA = worksheet.getCell(rowToCheck, 1);
        const cellAValue = cellA.value;
        if (cellAValue && cellAValue !== '1 - Blank Row' && cellAValue.toString().trim().length > 0) {
          allRowsEmpty = false;
          console.log(`[Row Cleanup] Row ${rowToCheck} has data in column A: "${cellAValue.toString().substring(0, 50)}"`);
          break;
        }
        
        // Check columns D-H (our working columns) for actual data
        // We're checking D-H because those are the columns we populate
        for (let col = 4; col <= 8; col++) {
          const cell = worksheet.getCell(rowToCheck, col);
          const cellValue = cell.value;
          
          // If cell has meaningful data (not empty/null/zero/empty string), don't delete
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
        }
        if (!allRowsEmpty) break;
      } catch (e) {
        // If we can't access the row, assume it's empty and can be deleted
        // This might happen if the row is beyond the worksheet range
        console.warn(`[Row Cleanup] Warning: Could not check row ${rowToCheck}, assuming empty:`, e);
      }
    }
    
    if (allRowsEmpty && rowsToDelete > 0) {
      // All rows are empty - delete them all at once (more efficient)
      try {
        console.log(`[Row Cleanup] All ${rowsToDelete} rows are empty. Deleting in one batch...`);
        
        // Check worksheet row count before deletion
        const rowCountBefore = worksheet.rowCount;
        console.log(`[Row Cleanup] Worksheet row count before deletion: ${rowCountBefore}`);
        
        // Verify spliceRows method exists before calling it
        if (typeof worksheet.spliceRows !== 'function') {
          console.warn(`[Row Cleanup] spliceRows method not available, trying alternative method...`);
          
          // Alternative: Delete rows one by one from bottom to top (avoids index shifting issues)
          console.log(`[Row Cleanup] Using alternative deletion method: deleting from bottom to top...`);
          let deletedCount = 0;
          for (let rowToDelete = lastRowToDelete; rowToDelete >= firstRowToDelete; rowToDelete--) {
            try {
              // Check if row exists
              const testCell = worksheet.getCell(rowToDelete, 1);
              if (testCell) {
                worksheet.spliceRows(rowToDelete, 1);
                deletedCount++;
              }
            } catch (e) {
              console.warn(`[Row Cleanup] Could not delete row ${rowToDelete}:`, e);
            }
          }
          
          if (deletedCount > 0) {
            console.log(`[Row Cleanup] Successfully deleted ${deletedCount} rows using alternative method`);
            console.log(`[Row Cleanup] Final result: ${bufferRows} buffer rows after last data row (rows ${firstRowToKeep}-${lastRowToKeep})`);
            
            // Set up buffer rows after deletion
            for (let i = 0; i < bufferRows; i++) {
              const bufferRowNum = firstRowToKeep + i;
              try {
                const cellA = worksheet.getCell(bufferRowNum, 1);
                const cellB = worksheet.getCell(bufferRowNum, 2);
                cellA.value = '1 - Blank Row';
                cellB.value = null;
                for (let col = 4; col <= 14; col++) {
                  try {
                    worksheet.getCell(bufferRowNum, col).value = null;
                  } catch (e) {
                    // Ignore
                  }
                }
              } catch (e) {
                console.warn(`[Row Cleanup] Warning: Could not set up buffer row ${bufferRowNum}:`, e);
              }
            }
            console.log(`[Row Cleanup] Set up ${bufferRows} buffer rows with "1 - Blank Row" labels`);
            return true;
          } else {
            console.warn(`[Row Cleanup] Alternative deletion method failed, no rows deleted`);
            return false;
          }
        }
        
        // Use spliceRows if available (more efficient)
        console.log(`[Row Cleanup] Calling spliceRows(${firstRowToDelete}, ${rowsToDelete})...`);
        
        // ExcelJS spliceRows(start, count) - deletes 'count' rows starting from 'start' (1-indexed)
        // Note: ExcelJS might use 0-indexed or 1-indexed, so we verify the behavior
        try {
          worksheet.spliceRows(firstRowToDelete, rowsToDelete);
        } catch (spliceError: any) {
          console.error(`[Row Cleanup] Error with spliceRows, trying alternative method:`, spliceError?.message || spliceError);
          // Fall back to alternative method if spliceRows fails
          let deletedCount = 0;
          for (let rowToDelete = lastRowToDelete; rowToDelete >= firstRowToDelete; rowToDelete--) {
            try {
              const testCell = worksheet.getCell(rowToDelete, 1);
              if (testCell) {
                worksheet.spliceRows(rowToDelete, 1);
                deletedCount++;
              }
            } catch (e) {
              console.warn(`[Row Cleanup] Could not delete row ${rowToDelete}:`, e);
            }
          }
          console.log(`[Row Cleanup] Deleted ${deletedCount} rows using fallback method`);
        }
        
        // Check row count after deletion to verify deletion worked
        const rowCountAfter = worksheet.rowCount;
        const rowsDeleted = rowCountBefore - rowCountAfter;
        console.log(`[Row Cleanup] Worksheet row count after deletion: ${rowCountAfter} (deleted: ${rowsDeleted} rows)`);
        
        // Verify that the rows we wanted to delete are actually gone
        // Check a few rows that should have been deleted
        let verifiedDeleted = true;
        for (let checkRow = firstRowToDelete; checkRow <= Math.min(firstRowToDelete + 5, lastRowToDelete); checkRow++) {
          try {
            const checkCell = worksheet.getCell(checkRow, 1);
            // If row was deleted, accessing it might throw or return a different row (shifted up)
            // Check if the row now contains what should be in a buffer row
            if (checkRow <= lastRowToKeep && checkCell.value === '1 - Blank Row') {
              // This is expected - buffer row
              continue;
            } else if (checkRow > lastRowToKeep) {
              // This row should have been deleted - verify it's empty or doesn't exist
              const hasData = checkCell.value && checkCell.value !== '1 - Blank Row';
              if (hasData) {
                console.warn(`[Row Cleanup] Row ${checkRow} should have been deleted but still has data: ${checkCell.value}`);
              }
            }
          } catch (e) {
            // Row might not exist anymore, which is good
          }
        }
        
        console.log(`[Row Cleanup] Successfully deleted rows (rows ${firstRowToDelete}-${lastRowToDelete})`);
        console.log(`[Row Cleanup] Final result: ${bufferRows} buffer rows after last data row (rows ${firstRowToKeep}-${lastRowToKeep})`);
        
        // Set up buffer rows with proper labels after deletion
        // Buffer rows should have: Column A = "1 - Blank Row", Column B = empty, D-N = empty
        for (let i = 0; i < bufferRows; i++) {
          const bufferRowNum = firstRowToKeep + i;
          try {
            const cellA = worksheet.getCell(bufferRowNum, 1);
            const cellB = worksheet.getCell(bufferRowNum, 2);
            
            // Set Column A to "1 - Blank Row"
            cellA.value = '1 - Blank Row';
            
            // Set Column B to empty
            cellB.value = null;
            
            // Clear columns D-N (4-14) for visual separation
            for (let col = 4; col <= 14; col++) {
              try {
                const cell = worksheet.getCell(bufferRowNum, col);
                cell.value = null;
              } catch (e) {
                // Ignore errors for cells that don't exist
              }
            }
          } catch (e) {
            console.warn(`[Row Cleanup] Warning: Could not set up buffer row ${bufferRowNum}:`, e);
          }
        }
        console.log(`[Row Cleanup] Set up ${bufferRows} buffer rows with "1 - Blank Row" labels`);
        
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
 * Uses Template-V2.xlsx with conditional formatting based on Column A values
 * @param items - Array of order items from email parser
 * @param location - Location object with orderNo, streetAddress, city, state, zip
 * @param addendumData - Array of addendum data (optional)
 * @param deleteExtraRows - Whether to delete extra rows after end marker (optional, default: false)
 * @returns Excel file buffer
 */
export async function generateSpreadsheet(
  items: OrderItem[], 
  location: Location, 
  addendumData: AddendumData[] = [],
  deleteExtraRows: boolean = false,
  orderId?: string // Optional orderId to fetch invoices from database
): Promise<Buffer> {
  // Load Template-V2.xlsx template file
  const templatePath = path.join(process.cwd(), 'contract-parser', 'Template-V2.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);
  
  // Get the first worksheet (or named "Order Items")
  let worksheet = workbook.getWorksheet('Order Items') || workbook.worksheets[0];
  
  // Clean shared formulas from rows 16-339 (rows we'll be working with)
  // This prevents "Shared Formula master must exist" errors when saving
  const maxRow = 339;
  cleanSharedFormulasFromRange(worksheet, 16, maxRow);
  
  // Rename worksheet to "#OrderNo-Street Address"
  const sheetName = sanitizeSheetName(`#${location.orderNo}-${location.streetAddress}`);
  worksheet.name = sheetName;
  
  // Row 16 is now treated as a regular row for data (first Main Category Header)
  // Start populating data from row 16
  let currentRow = 16;
  
  // Process items and append them
  // Track if this is the first item to determine if we need an empty row above
  let isFirstItem = true;
  
  for (const item of items) {
    // Process main category headers - add empty row above and write with Column A/B labels
    if (item.type === 'maincategory') {
      // Add empty row above main category (except for the first item at row 16)
      if (!isFirstItem) {
        currentRow++;
        
        // Set up blank row for visual separation
        const blankRow = currentRow;
        const blankCellA = worksheet.getCell(blankRow, 1);
        const blankCellB = worksheet.getCell(blankRow, 2);
        
        // Label Column A as "1 - Blank Row"
        blankCellA.value = '1 - Blank Row';
        
        // Column B is empty
        blankCellB.value = null;
        
        // Ensure empty values on columns D-N (columns 4-14)
        for (let col = 4; col <= 14; col++) {
          try {
            const cell = worksheet.getCell(blankRow, col);
            cell.value = null;
          } catch (e) {
            // Ignore errors for cells that don't exist
          }
        }
        
        currentRow++; // Move to the main category row
      }
      isFirstItem = false;
      
      // Clean the text to remove asterisks, special characters, and formatting
      let cleanedText = (item.productService || '').toString();
      cleanedText = cleanedText.replace(/\*\*/g, '').replace(/\*/g, '');
      cleanedText = cleanedText.replace(/[\u200B-\u200D\uFEFF]/g, '');
      cleanedText = cleanedText.replace(/[\u202A-\u202E]/g, '');
      cleanedText = cleanedText.replace(/[\u2060-\u206F]/g, '');
      cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
      
      const row = currentRow;
      
      // Get cells for main category
      const cellA = worksheet.getCell(row, 1);
      const cellB = worksheet.getCell(row, 2);
      const cellD = worksheet.getCell(row, 4);
      const cellE = worksheet.getCell(row, 5);
      const cellF = worksheet.getCell(row, 6);
      const cellG = worksheet.getCell(row, 7);
      const cellH = worksheet.getCell(row, 8);
      
      // Set Column A to "1 - Header" (plain value, not formula)
      cellA.value = '1 - Header';
      
      // Set Column B to "Initial" for email items (plain value)
      cellB.value = 'Initial';
      
      // Set main category text in Column D (merged D-E)
      cellD.value = cleanedText;
      
      // Merge D:E
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
    
      // Set F, G, H to null/empty for main categories
      cellF.value = null;
      cellG.value = null;
      cellH.value = null;
      
      // Ensure all values are plain values (no formulas)
      // No formatting needed - let template conditional formatting handle it
      
      currentRow++;
      continue;
    } else if (item.type === 'subcategory') {
      // Sub-category header row - populate data with plain values only
      const row = currentRow;
      isFirstItem = false; // Mark that we've processed at least one item
      
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
      const cellA = worksheet.getCell(row, 1);
      const cellB = worksheet.getCell(row, 2);
      const cellD = worksheet.getCell(row, 4);
      const cellE = worksheet.getCell(row, 5);
      const cellF = worksheet.getCell(row, 6);
      const cellG = worksheet.getCell(row, 7);
      const cellH = worksheet.getCell(row, 8);
      
      // Set Column A to "1 - Subheader" (plain value, not formula)
      cellA.value = '1 - Subheader';
      
      // Set Column B to "Initial" for email items (plain value)
      cellB.value = 'Initial';
      
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
      
      // Set value ONLY (plain value, no formatting)
      cellD.value = cleanedText;
      
      // Explicitly set F, G, H to empty/null for subcategories
      cellF.value = null;
      cellG.value = null;
      cellH.value = null;
      
      // Template-V2.xlsx uses conditional formatting based on Column A values
      // No need to clear or apply formatting - let the template handle it
      
      // Clear any shared formula reference
      if ((cellD as any).sharedFormula) delete (cellD as any).sharedFormula;
      
      currentRow++;
      
      } else if (item.type === 'item') {
        // Line item row - paste values with NO formatting
        const row = currentRow;
        isFirstItem = false; // Mark that we've processed at least one item
        
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
        
        // Get all cells for this row
        const cellA = worksheet.getCell(row, 1);
        const cellB = worksheet.getCell(row, 2);
        const cellD = worksheet.getCell(row, 4);
        const cellE = worksheet.getCell(row, 5);
        const cellF = worksheet.getCell(row, 6);
        const cellG = worksheet.getCell(row, 7);
        const cellH = worksheet.getCell(row, 8);
        const cellI = worksheet.getCell(row, 9);  // % Progress Overall (input)
        const cellK = worksheet.getCell(row, 11); // % PREVIOUSLY INVOICED (input)
        // Columns J, L, M, N are formula columns - don't populate, let template formulas handle them
        
        // Set Column A to "1 - Detail" for line items (plain value)
        cellA.value = '1 - Detail';
        
        // Set Column B to "Initial" for email items (plain value)
        cellB.value = 'Initial';
        
        // Set values (plain values, no formulas)
        cellD.value = cleanedText;
        // Ensure numeric values are plain numbers, not formulas
        const qtyValue = item.qty !== '' && item.qty !== null && item.qty !== undefined ? (typeof item.qty === 'number' ? item.qty : parseFloat(String(item.qty)) || 0) : 0;
        const rateValue = item.rate !== '' && item.rate !== null && item.rate !== undefined ? (typeof item.rate === 'number' ? item.rate : parseFloat(String(item.rate)) || 0) : 0;
        const amountValue = item.amount !== '' && item.amount !== null && item.amount !== undefined ? (typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount)) || 0) : 0;
        
        cellF.value = qtyValue;
        cellG.value = rateValue;
        cellH.value = amountValue;
        
        // Populate only input columns I and K (progress payment input columns)
        // Column I: % Progress Overall (as decimal, e.g., 0.5 for 50%)
        // This is an input value - user enters the percentage
        const progressOverallPct = item.progressOverallPct !== '' && item.progressOverallPct !== null && item.progressOverallPct !== undefined
          ? (typeof item.progressOverallPct === 'number' ? item.progressOverallPct / 100 : parseFloat(String(item.progressOverallPct)) / 100 || 0)
          : 0;
        cellI.value = progressOverallPct;
        
        // Column J: $ Completed - DO NOT populate, let template formula handle it (J = I * H)
        // The dashboard shows calculated values for viewing, but spreadsheet uses formulas
        
        // Column K: % PREVIOUSLY INVOICED (as decimal)
        // This is an input value - user enters the percentage
        const previouslyInvoicedPct = item.previouslyInvoicedPct !== '' && item.previouslyInvoicedPct !== null && item.previouslyInvoicedPct !== undefined
          ? (typeof item.previouslyInvoicedPct === 'number' ? item.previouslyInvoicedPct / 100 : parseFloat(String(item.previouslyInvoicedPct)) / 100 || 0)
          : 0;
        cellK.value = previouslyInvoicedPct;
        
        // Column L: $ PREVIOUSLY INVOICED - DO NOT populate, let template formula handle it (L = H * K)
        // Column M: % NEW PROGRESS - DO NOT populate, let template formula handle it (M = I - K)
        // Column N: THIS BILL - DO NOT populate, let template formula handle it (N = M * H)
        // The template formulas will automatically calculate these based on I, K, and H
        
        // Merge D:E
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
        
        // Template-V2.xlsx uses conditional formatting based on Column A values
        // No need to clear or apply formatting - let the template handle it
      
        currentRow++;
    }
  }
  
  console.log(`[Data Population] Current row after processing email items: ${currentRow}`);
  
  // STEP 1.5: Process addendum data if provided
  // Addendums should be inserted AFTER email parser items with 2 blank rows separator
  if (addendumData && addendumData.length > 0) {
    console.log(`[Data Population] Processing ${addendumData.length} addendum(s)...`);
    
    // Find last row with data after email parser items
    const lastEmailItemRow = currentRow - 1;
    
    // Insert 2 blank rows before addendums
    const addendumStartRow = lastEmailItemRow + 3; // Skip 2 blank rows
    currentRow = addendumStartRow;
    
    console.log(`[Data Population] Starting addendums at row ${currentRow} (after ${lastEmailItemRow}, skipped 2 blank rows)`);
    
    // Process each addendum
    for (let addendumIndex = 0; addendumIndex < addendumData.length; addendumIndex++) {
      const addendum = addendumData[addendumIndex];
      console.log(`[Data Population] Processing addendum #${addendum.addendumNumber} (${addendumIndex + 1}/${addendumData.length})`);
      
      // Add "Addendum #: X" header row
      const addendumHeaderRow = currentRow;
      
      // Format: "Addendum #7 (35587)"
      const addendumNum = addendum.addendumNumber;
      const urlId = addendum.urlId || addendum.addendumNumber; // Fallback to addendumNumber if urlId not available
      const headerText = `Addendum #${addendumNum} (${urlId})`;
      console.log(`[Data Population] Addendum header #${addendumIndex + 1} at row ${addendumHeaderRow}: "${headerText}"`);
      
      // Get cells for addendum header
      const cellA = worksheet.getCell(addendumHeaderRow, 1);
      const cellB = worksheet.getCell(addendumHeaderRow, 2);
      const cellD = worksheet.getCell(addendumHeaderRow, 4);
      const cellE = worksheet.getCell(addendumHeaderRow, 5);
      const cellF = worksheet.getCell(addendumHeaderRow, 6);
      const cellG = worksheet.getCell(addendumHeaderRow, 7);
      const cellH = worksheet.getCell(addendumHeaderRow, 8);
      
      // Set Column A to "1 - Header" (plain value) - addendum headers are treated as headers
      cellA.value = '1 - Header';
      
      // Set Column B to "Addendum" for addendum items (plain value)
      cellB.value = 'Addendum';
      
      // Merge D:E FIRST (before setting value)
      try {
        const isMerged = worksheet.model.merges?.some((merge: any) => {
          return merge.top <= addendumHeaderRow && merge.bottom >= addendumHeaderRow &&
                 merge.left <= 4 && merge.right >= 5;
        });
        if (!isMerged) {
          worksheet.mergeCells(addendumHeaderRow, 4, addendumHeaderRow, 5);
        }
      } catch (e) {
        // Merge might already exist, ignore error
      }
      
      // Set value: "Addendum #7 (35587)" format (reuse variables from above)
      cellD.value = headerText;
      
      // Explicitly set F, G, H to empty/null for addendum header
      cellF.value = null;
      cellG.value = null;
      cellH.value = null;
      
      // Template-V2.xlsx uses conditional formatting based on Column A values
      // No need to clear or apply formatting - let the template handle it
      
      // Clear any shared formula reference
      if ((cellD as any).sharedFormula) delete (cellD as any).sharedFormula;
      
      currentRow++; // Move to next row for addendum items
      
      // Process addendum items
      for (const item of addendum.items) {
        // Process main category headers for addendums - add empty row above and write with Column A/B labels
        if (item.type === 'maincategory') {
          // Add empty row above main category
          currentRow++;
          
          // Set up blank row for visual separation
          const blankRow = currentRow;
          const blankCellA = worksheet.getCell(blankRow, 1);
          const blankCellB = worksheet.getCell(blankRow, 2);
          
          // Label Column A as "1 - Blank Row"
          blankCellA.value = '1 - Blank Row';
          
          // Column B is empty
          blankCellB.value = null;
          
          // Ensure empty values on columns D-N (columns 4-14)
          for (let col = 4; col <= 14; col++) {
            try {
              const cell = worksheet.getCell(blankRow, col);
              cell.value = null;
            } catch (e) {
              // Ignore errors for cells that don't exist
            }
          }
          
          currentRow++; // Move to the main category row
          
          // Clean the text to remove asterisks, special characters, and formatting
          let cleanedText = (item.productService || '').toString();
          cleanedText = cleanedText.replace(/\*\*/g, '').replace(/\*/g, '');
          cleanedText = cleanedText.replace(/[\u200B-\u200D\uFEFF]/g, '');
          cleanedText = cleanedText.replace(/[\u202A-\u202E]/g, '');
          cleanedText = cleanedText.replace(/[\u2060-\u206F]/g, '');
          cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
          
          const row = currentRow;
          
          // Get cells for main category
          const cellA = worksheet.getCell(row, 1);
          const cellB = worksheet.getCell(row, 2);
          const cellD = worksheet.getCell(row, 4);
          const cellE = worksheet.getCell(row, 5);
          const cellF = worksheet.getCell(row, 6);
        const cellG = worksheet.getCell(row, 7);
          const cellH = worksheet.getCell(row, 8);
          
          // Set Column A to "1 - Header" (plain value, not formula)
          cellA.value = '1 - Header';
          
          // Set Column B to "Addendum" for addendum items (plain value)
          cellB.value = 'Addendum';
          
          // Set main category text in Column D (merged D-E)
          cellD.value = cleanedText;
          
          // Merge D:E
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
          
          // Set F, G, H to null/empty for main categories
          cellF.value = null;
          cellG.value = null;
          cellH.value = null;
          
          // Ensure all values are plain values (no formulas)
          // No formatting needed - let template conditional formatting handle it
          
          currentRow++;
          continue;
        } else if (item.type === 'subcategory') {
          // Sub-category header row - populate data with plain values only
          const row = currentRow;
          
          console.log(`[Data Population] Addendum subcategory at row ${row}: "${item.productService?.toString().substring(0, 50)}..."`);
          
          // Clean the text to remove asterisks, special characters, and formatting
          let cleanedText = (item.productService || '').toString();
          cleanedText = cleanedText.replace(/\*\*/g, '').replace(/\*/g, '');
          cleanedText = cleanedText.replace(/[\u200B-\u200D\uFEFF]/g, '');
          cleanedText = cleanedText.replace(/[\u202A-\u202E]/g, '');
          cleanedText = cleanedText.replace(/[\u2060-\u206F]/g, '');
          cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
          
          // Get cells
          const cellA = worksheet.getCell(row, 1);
          const cellB = worksheet.getCell(row, 2);
          const subCellD = worksheet.getCell(row, 4);
          const subCellE = worksheet.getCell(row, 5);
          const subCellF = worksheet.getCell(row, 6);
          const subCellG = worksheet.getCell(row, 7);
          const subCellH = worksheet.getCell(row, 8);
          
          // Set Column A to "1 - Subheader" (plain value, not formula)
          cellA.value = '1 - Subheader';
          
          // Set Column B to "Addendum" for addendum items (plain value)
          cellB.value = 'Addendum';
          
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
          subCellD.value = cleanedText;
          
          // Explicitly set F, G, H to empty/null for subcategories
          subCellF.value = null;
          subCellG.value = null;
          subCellH.value = null;
          
          // Template-V2.xlsx uses conditional formatting based on Column A values
          // No need to clear or apply formatting - let the template handle it
          
          // Clear any shared formula reference
          if ((subCellD as any).sharedFormula) delete (subCellD as any).sharedFormula;
          
          currentRow++;
        } else if (item.type === 'item') {
          // Line item row - paste values with NO formatting
          const row = currentRow;
          
          // Clean the text FIRST - remove asterisks, special characters, and formatting
          let cleanedText = (item.productService || '').toString();
          cleanedText = cleanedText.replace(/\*\*/g, '').replace(/\*/g, '');
          cleanedText = cleanedText.replace(/[\u200B-\u200D\uFEFF]/g, '');
          cleanedText = cleanedText.replace(/[\u202A-\u202E]/g, '');
          cleanedText = cleanedText.replace(/[\u2060-\u206F]/g, '');
          cleanedText = cleanedText.replace(/[\uE000-\uF8FF]/g, '');
          cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
          
          // Get all cells for this row
          const cellA = worksheet.getCell(row, 1);
          const cellB = worksheet.getCell(row, 2);
          const cellD = worksheet.getCell(row, 4);
          const cellE = worksheet.getCell(row, 5);
          const cellF = worksheet.getCell(row, 6);
          const cellG = worksheet.getCell(row, 7);
        const cellH = worksheet.getCell(row, 8);
          const cellI = worksheet.getCell(row, 9);  // % Progress Overall (input)
          const cellK = worksheet.getCell(row, 11); // % PREVIOUSLY INVOICED (input)
          // Columns J, L, M, N are formula columns - don't populate, let template formulas handle them
          
          // Set Column A to "1 - Detail" for line items (plain value)
          cellA.value = '1 - Detail';
          
          // Set Column B to "Addendum" for addendum items (plain value)
          cellB.value = 'Addendum';
          
          // Set values (plain values, no formulas)
          // For addendums: Description in D-E, Qty in F, Extended in H, G is empty
          cellD.value = cleanedText;
          // Ensure numeric values are plain numbers, not formulas
          const qtyValue = item.qty !== '' && item.qty !== null && item.qty !== undefined ? (typeof item.qty === 'number' ? item.qty : parseFloat(String(item.qty)) || 0) : 0;
          const amountValue = item.amount !== '' && item.amount !== null && item.amount !== undefined ? (typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount)) || 0) : 0;
          
          cellF.value = qtyValue;
          cellG.value = null; // No rate for addendums - leave empty
          cellH.value = amountValue;
          
          // Populate only input columns I and K (progress payment input columns)
          // Column I: % Progress Overall (as decimal, e.g., 0.5 for 50%)
          // This is an input value - user enters the percentage
          const progressOverallPct = item.progressOverallPct !== '' && item.progressOverallPct !== null && item.progressOverallPct !== undefined
            ? (typeof item.progressOverallPct === 'number' ? item.progressOverallPct / 100 : parseFloat(String(item.progressOverallPct)) / 100 || 0)
            : 0;
          cellI.value = progressOverallPct;
          
          // Column J: $ Completed - DO NOT populate, let template formula handle it (J = I * H)
          // The dashboard shows calculated values for viewing, but spreadsheet uses formulas
          
          // Column K: % PREVIOUSLY INVOICED (as decimal)
          // This is an input value - user enters the percentage
          const previouslyInvoicedPct = item.previouslyInvoicedPct !== '' && item.previouslyInvoicedPct !== null && item.previouslyInvoicedPct !== undefined
            ? (typeof item.previouslyInvoicedPct === 'number' ? item.previouslyInvoicedPct / 100 : parseFloat(String(item.previouslyInvoicedPct)) / 100 || 0)
            : 0;
          cellK.value = previouslyInvoicedPct;
          
          // Column L: $ PREVIOUSLY INVOICED - DO NOT populate, let template formula handle it (L = H * K)
          // Column M: % NEW PROGRESS - DO NOT populate, let template formula handle it (M = I - K)
          // Column N: THIS BILL - DO NOT populate, let template formula handle it (N = M * H)
          // The template formulas will automatically calculate these based on I, K, and H
          
          // Merge D:E
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
          
          // Template-V2.xlsx uses conditional formatting based on Column A values
          // No need to clear or apply formatting - let the template handle it
      
        currentRow++;
    }
  }
  
      console.log(`[Data Population] Completed addendum #${addendum.addendumNumber}: ${addendum.items.length} items processed`);
    }
    
    console.log(`[Data Population] All addendums processed. Final row: ${currentRow - 1}`);
  }
  
  // Store the last data row - this is the last row with actual data
  const lastDataRow = currentRow - 1; // currentRow is the next row to write
  
  console.log(`[Data Population] Last data row: ${lastDataRow}`);
  
  // PASS 1: Add buffer rows and end marker
  const bufferRows = 5;
  
  // Add 5 buffer rows after last data row
  for (let i = 1; i <= bufferRows; i++) {
    const bufferRowNum = lastDataRow + i;
    const blankCellA = worksheet.getCell(bufferRowNum, 1);
    const blankCellB = worksheet.getCell(bufferRowNum, 2);
    
    // Label Column A as "1 - Blank Row"
    blankCellA.value = '1 - Blank Row';
    
    // Column B is empty
    blankCellB.value = null;
    
    // Ensure empty values on columns D-N (columns 4-14)
    for (let col = 4; col <= 14; col++) {
      try {
        const cell = worksheet.getCell(bufferRowNum, col);
        cell.value = null;
      } catch (e) {
        // Ignore errors for cells that don't exist
      }
    }
  }
  
  // Add end marker row after buffer rows
  const endMarkerRow = lastDataRow + bufferRows + 1;
  const markerCellA = worksheet.getCell(endMarkerRow, 1);
  const markerCellB = worksheet.getCell(endMarkerRow, 2);
  
  // Column A = "1 - Header" (to match conditional formatting pattern)
  markerCellA.value = '1 - Header';
  
  // Column B = "Last Row" (to identify this as the end marker)
  markerCellB.value = 'Last Row';
  
  // Clear columns D-N for the marker row
  for (let col = 4; col <= 14; col++) {
    try {
      const cell = worksheet.getCell(endMarkerRow, col);
      cell.value = null;
    } catch (e) {
      // Ignore errors for cells that don't exist
    }
  }
  
  console.log(`[Data Population] Added ${bufferRows} buffer rows and end marker at row ${endMarkerRow}`);
  
  // Populate invoices (rows 354-391) if orderId is provided
  if (orderId) {
    try {
      console.log(`[Data Population] Fetching invoices for order ${orderId}...`);
      const invoiceList = await db.query.invoices.findMany({
        where: eq(invoices.orderId, orderId),
        orderBy: invoices.rowIndex,
      });

      console.log(`[Data Population] Found ${invoiceList.length} invoices to populate`);

      // Populate invoice rows (354-391)
      for (let i = 0; i < invoiceList.length && i < 38; i++) { // Max 38 invoices (354-391)
        const invoice = invoiceList[i];
        const row = 354 + i; // Start at row 354

        // Get cells for invoice row
        const cellA = worksheet.getCell(row, 1); // Status (formula - DO NOT POPULATE)
        const cellB = worksheet.getCell(row, 2); // Exclude (value - POPULATE)
        const cellD = worksheet.getCell(row, 4); // Invoice Number (value - POPULATE)
        const cellE = worksheet.getCell(row, 5); // Invoice Date (value - POPULATE)
        const cellF = worksheet.getCell(row, 6); // Invoice Amount (value - POPULATE)
        const cellG = worksheet.getCell(row, 7); // Payments Received (value - POPULATE)
        const cellH = worksheet.getCell(row, 8); // Open Balance (formula - DO NOT POPULATE)

        // Check if cells have formulas before populating
        // Column A: Status formula - DO NOT POPULATE
        if (!cellA.formula) {
          // If no formula exists, we might need to add it, but for now skip
          console.warn(`[Data Population] Row ${row} Column A has no formula, skipping`);
        }

        // Column B: Exclude (value field - POPULATE)
        if (!cellB.formula) {
          cellB.value = invoice.exclude ? 'Exclude' : null;
        }

        // Column D: Invoice Number (value field - POPULATE)
        if (!cellD.formula) {
          cellD.value = invoice.invoiceNumber || null;
        }

        // Column E: Invoice Date (value field - POPULATE)
        if (!cellE.formula) {
          if (invoice.invoiceDate) {
            cellE.value = new Date(invoice.invoiceDate);
            cellE.numFmt = 'mm/dd/yyyy'; // Format as date
          } else {
            cellE.value = null;
          }
        }

        // Column F: Invoice Amount (value field - POPULATE)
        if (!cellF.formula) {
          if (invoice.invoiceAmount) {
            cellF.value = parseFloat(invoice.invoiceAmount.toString());
          } else {
            cellF.value = null;
          }
        }

        // Column G: Payments Received (value field - POPULATE)
        if (!cellG.formula) {
          if (invoice.paymentsReceived) {
            cellG.value = parseFloat(invoice.paymentsReceived.toString());
          } else {
            cellG.value = 0;
          }
        }

        // Column H: Open Balance (formula - DO NOT POPULATE)
        if (cellH.formula) {
          // Formula exists, preserve it
          console.log(`[Data Population] Row ${row} Column H has formula, preserving: ${cellH.formula}`);
        }
      }

      console.log(`[Data Population] Populated ${Math.min(invoiceList.length, 38)} invoice rows`);
    } catch (error) {
      console.error(`[Data Population] Error populating invoices:`, error);
      // Continue even if invoice population fails
    }
  }
  
  // Clean shared formulas from the deletion range (rows after marker up to 338)
  // This prevents issues during row deletion in Pass 2
  const deletionStartRow = endMarkerRow + 1;
  const deletionEndRow = 338;
  if (deletionStartRow <= deletionEndRow) {
    console.log(`[Data Population] Cleaning shared formulas in deletion range (rows ${deletionStartRow}-${deletionEndRow})...`);
    cleanSharedFormulasFromRange(worksheet, deletionStartRow, deletionEndRow);
  }
  
  // Generate buffer with data populated and end marker set
  // Template-V2.xlsx uses conditional formatting based on Column A values
  // No manual formatting needed - the template handles all formatting automatically
  const initialBuffer = await workbook.xlsx.writeBuffer();
  console.log(`[Pass 1] Generated buffer: ${initialBuffer.byteLength} bytes`);
  
  // Verify buffer was generated successfully
  if (!initialBuffer || initialBuffer.byteLength === 0) {
    throw new Error('Failed to generate buffer');
  }
  
  // PASS 2: Delete rows after end marker up to row 338 (only if deleteExtraRows is enabled)
  if (deleteExtraRows) {
    console.log(`[Pass 2] Starting row deletion: deleting rows ${deletionStartRow} to ${deletionEndRow}...`);
    
    // Convert initialBuffer to Node.js Buffer if needed
    const initialBufferNode = Buffer.from(initialBuffer);
    
    const finalBuffer = await deleteRowsAfterMarker(
      initialBufferNode,
      sheetName,
      endMarkerRow,
      deletionEndRow
    );
    
    console.log(`[Pass 2] Row deletion complete. Final buffer: ${finalBuffer.byteLength} bytes`);
    
    // Return the final buffer after row deletion
    return finalBuffer;
  } else {
    console.log(`[Pass 2] Row deletion skipped (deleteExtraRows is false). End marker at row ${endMarkerRow} indicates where data ends.`);
    // Return the buffer with end marker (no deletion)
    return Buffer.from(initialBuffer);
  }
}
