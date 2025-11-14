import XLSXPopulate from 'xlsx-populate';

/**
 * Convert column number to Excel column letter (1 = A, 2 = B, etc.)
 * @param col - Column number (1-indexed)
 * @returns Excel column letter(s)
 */
function colToLetter(col: number): string {
  let result = '';
  while (col > 0) {
    col--;
    result = String.fromCharCode(65 + (col % 26)) + result;
    col = Math.floor(col / 26);
  }
  return result;
}

/**
 * Format subcategory header using XLSX-Populate
 * This library is better at preserving formatting when reading/writing buffers
 * Subcategory rows serve as visual separators extending to column BE
 * @param workbook - XLSX-Populate workbook
 * @param sheetName - Sheet name
 * @param row - Row number (1-indexed)
 * @param startCol - Start column number (1-indexed, 4 = D)
 * @param endCol - End column number (1-indexed, 57 = BE)
 */
export async function formatSubCategoryHeaderXLSXPopulate(
  workbook: XLSXPopulate.Workbook,
  sheetName: string,
  row: number,
  startCol: number,
  endCol: number
): Promise<void> {
  const sheet = workbook.sheet(sheetName);
  
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }
  
  try {
    // STEP 1: Merge and format columns D:E (Product/Services) with text formatting
    // Create Excel address for D:E range (e.g., "D16:E16")
    const startColLetter = colToLetter(startCol);
    const endColLetter = colToLetter(5); // Column E (5)
    const deRangeAddress = `${startColLetter}${row}:${endColLetter}${row}`;
    
    // Get the range and merge cells D:E
    const deRange = sheet.range(deRangeAddress);
    deRange.merged(true);
    
    // Apply formatting to D:E with text (white font, bold, fill color)
    deRange.style({
      fill: '495568', // #495568 (solid fill) - RGB without alpha
      fontColor: 'ffffff', // White font - RGB without alpha
      bold: true,
      fontSize: 11,
      verticalAlignment: 'center',
      indent: 1,
      wrapText: true
    });
    
    // STEP 2: Format columns F through BE (6-57) with fill color only (no text)
    // These columns should be blank but have the same fill color as visual separator
    if (endCol > 5) {
      // Create range for F:BE (columns 6-57)
      const fColLetter = colToLetter(6); // Column F (6)
      const beColLetter = colToLetter(endCol); // Column BE (57)
      const fBeRangeAddress = `${fColLetter}${row}:${beColLetter}${row}`;
      
      const fBeRange = sheet.range(fBeRangeAddress);
      
      // Apply fill color ONLY (no font color, no bold, no text formatting)
      // This ensures these cells are blank but visually separated
      fBeRange.style({
        fill: '495568', // #495568 (solid fill) - RGB without alpha
        // No fontColor - default black (won't matter since cells are blank)
        bold: false,
        fontSize: 11
      });
      
      // CRITICAL: Ensure all cells from F to BE are blank (no values)
      // Clear any values that might exist in these cells
      for (let col = 6; col <= endCol; col++) {
        try {
          const cell = sheet.cell(row, col);
          // Clear any value - subcategory rows should only have text in D-E
          const cellValue = cell.value();
          if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
            cell.value(null);
          }
        } catch (e) {
          // Ignore errors for cells that don't exist
        }
      }
    }
    
  } catch (error) {
    // Re-throw with more context
    const startColLetter = colToLetter(startCol);
    const endColLetter = colToLetter(endCol);
    const rangeAddress = `${startColLetter}${row}:${endColLetter}${row}`;
    throw new Error(`Failed to format subcategory header at row ${row}, range ${rangeAddress}: ${error}`);
  }
}

/**
 * Format location header using XLSX-Populate
 * @param workbook - XLSX-Populate workbook
 * @param sheetName - Sheet name
 * @param row - Row number (1-indexed, 16)
 * @param startCol - Start column number (1-indexed, 4 = D)
 * @param endCol - End column number (1-indexed, 5 = E)
 */
export async function formatLocationHeaderXLSXPopulate(
  workbook: XLSXPopulate.Workbook,
  sheetName: string,
  row: number,
  startCol: number,
  endCol: number
): Promise<void> {
  const sheet = workbook.sheet(sheetName);
  
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }
  
  // Create Excel address for the range (e.g., "D16:E16")
  const startColLetter = colToLetter(startCol);
  const endColLetter = colToLetter(endCol);
  const rangeAddress = `${startColLetter}${row}:${endColLetter}${row}`;
  
  // Get the range and merge cells D:E
  // In xlsx-populate, merged() is a method on Range, not Cell
  const range = sheet.range(rangeAddress);
  range.merged(true);
  
  // CRITICAL: Apply formatting to the RANGE itself, not individual cells
  // Formatting the range ensures it applies to the entire merged range correctly
  // This prevents formatting issues like white-on-white backgrounds
  range.style({
    fill: '495568', // #495568 (solid fill) - RGB without alpha
    fontColor: 'ffffff', // White font - RGB without alpha
    bold: true,
    fontSize: 11,
    verticalAlignment: 'center',
    wrapText: true
  });
  
  // CRITICAL: Do NOT format individual cells (D and E separately)
  // Formatting the range above is sufficient and more reliable
  // Formatting individual cells can cause formatting to leak or not apply correctly
}

/**
 * Clear formatting from a cell using XLSX-Populate
 * @param sheet - XLSX-Populate sheet
 * @param row - Row number (1-indexed)
 * @param col - Column number (1-indexed)
 */
export function clearCellFormattingXLSXPopulate(
  sheet: XLSXPopulate.Sheet,
  row: number,
  col: number
): void {
  const cell = sheet.cell(row, col);
  
  // Clear formatting by setting default style using XLSX-Populate API
  // Remove fill, set font to default (no bold, black color, default size)
  cell.style({
    fill: null, // Remove fill
    bold: false,
    fontSize: 11,
    fontColor: null // Default font color (black)
  });
}

