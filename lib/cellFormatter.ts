import ExcelJS from 'exceljs';

/**
 * Formatting options for cells
 */
export interface FormatOptions {
  bold?: boolean;
  fontSize?: number;
  fontColor?: string; // ARGB format (e.g., 'FFFFFFFF' for white)
  fillColor?: string; // ARGB format (e.g., 'FF495568' for #495568)
  alignment?: ExcelJS.Alignment;
}

/**
 * Clear all formatting from a cell (no fill, no bold, no font color, default font)
 * This ensures line items have no formatting
 * @param cell - Excel cell to clear formatting from
 */
export function clearCellFormatting(cell: ExcelJS.Cell): void {
  const cellModel = (cell as any).model;
  
  // STEP 1: Set fill to 'none' pattern explicitly (more reliable than deleting)
  // ExcelJS requires explicit fill type to remove fill colors
  try {
    // Set fill to 'none' pattern - this explicitly removes any fill color
    cell.fill = {
      type: 'pattern',
      pattern: 'none'
    };
  } catch (e) {
    // If setting 'none' fails, try empty object
    try {
      (cell as any).fill = {};
    } catch (e2) {
      // If that also fails, try deleting
      try {
        if ((cell as any).fill) {
          delete (cell as any).fill;
        }
      } catch (e3) {
        // Ignore all errors
      }
    }
  }
  
  // STEP 2: Set fill to 'none' in model.style (this is critical)
  if (cellModel) {
    if (!cellModel.style) {
      cellModel.style = {};
    }
    
    // Set fill to 'none' pattern in model.style (more reliable than deleting)
    cellModel.style.fill = {
      type: 'pattern',
      pattern: 'none'
    };
    
    // Reset font completely - create new font object with only size and bold:false
    cellModel.style.font = {
      size: 11,
      bold: false
    };
    
    // Remove any color properties from font
    if (cellModel.style.font && cellModel.style.font.color) {
      delete cellModel.style.font.color;
    }
  }
  
  // STEP 3: Set cell font properties directly (this overrides model.style)
  // Explicitly set font without color
  cell.font = {
    size: 11,
    bold: false
  };
  
  // STEP 4: Final verification - ensure fill is 'none' and font has no color
  try {
    // Double-check fill is 'none'
    cell.fill = {
      type: 'pattern',
      pattern: 'none'
    };
  } catch (e) {
    // Ignore errors
  }
  
  // STEP 5: Verify model.style is correct
  if (cellModel && cellModel.style) {
    // Ensure fill is 'none' in model.style
    cellModel.style.fill = {
      type: 'pattern',
      pattern: 'none'
    };
    
    // Ensure font has no color
    if (cellModel.style.font) {
      const fontWithoutColor: any = {
        size: cellModel.style.font.size || 11,
        bold: false
      };
      cellModel.style.font = fontWithoutColor;
    }
  }
}

/**
 * Apply formatting to a single cell
 * This function completely replaces the cell style to ensure formatting is applied
 * @param cell - Excel cell to format
 * @param options - Formatting options
 */
function applyCellFormatting(cell: ExcelJS.Cell, options: FormatOptions): void {
  const cellModel = (cell as any).model;
  
  // STEP 1: Apply formatting directly to cell FIRST (this is the most reliable)
  // This ensures the formatting is set before model.style is updated
  if (options.bold !== undefined || options.fontSize !== undefined || options.fontColor !== undefined) {
    const font: any = {};
    if (options.bold !== undefined) font.bold = options.bold;
    if (options.fontSize !== undefined) font.size = options.fontSize;
    if (options.fontColor !== undefined) font.color = { argb: options.fontColor };
    // Explicitly set font - this overrides template
    cell.font = font;
  }
  
  // Apply fill color directly to cell
  if (options.fillColor !== undefined) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: options.fillColor }
    };
  }
  
  // Apply alignment directly to cell
  if (options.alignment !== undefined) {
    cell.alignment = options.alignment;
  }
  
  // STEP 2: Update model.style to match what we just set
  // This ensures the formatting persists when the file is saved
  if (cellModel) {
    // Ensure style object exists
    if (!cellModel.style) {
      cellModel.style = {};
    }
    
    // Create new font object with all formatting properties
    if (options.bold !== undefined || options.fontSize !== undefined || options.fontColor !== undefined) {
      const newFont: any = {};
      if (options.bold !== undefined) newFont.bold = options.bold;
      if (options.fontSize !== undefined) newFont.size = options.fontSize;
      if (options.fontColor !== undefined) newFont.color = { argb: options.fontColor };
      // Completely replace model.style.font
      cellModel.style.font = newFont;
    }
    
    // Completely replace fill color in model.style
    if (options.fillColor !== undefined) {
      cellModel.style.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: options.fillColor }
      };
    } else {
      // If fillColor is not specified, remove any existing fill
      if (cellModel.style.fill) {
        delete cellModel.style.fill;
      }
    }
    
    // Update alignment in model.style
    if (options.alignment !== undefined) {
      cellModel.style.alignment = options.alignment;
    }
  }
  
  // STEP 3: Verify formatting was applied (re-apply if needed)
  // Sometimes ExcelJS needs the formatting to be set multiple times
  if (options.fillColor !== undefined) {
    // Double-check fill is set
    if (!cell.fill || (cell.fill as any).fgColor?.argb !== options.fillColor) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: options.fillColor }
      };
    }
  }
  
  if (options.bold !== undefined || options.fontColor !== undefined) {
    // Double-check font is set correctly
    const expectedBold = options.bold !== undefined ? options.bold : false;
    const expectedColor = options.fontColor || null;
    
    if (cell.font?.bold !== expectedBold || 
        (expectedColor && (cell.font as any)?.color?.argb !== expectedColor)) {
      const font: any = {};
      if (options.bold !== undefined) font.bold = options.bold;
      if (options.fontSize !== undefined) font.size = options.fontSize;
      if (options.fontColor !== undefined) font.color = { argb: options.fontColor };
      cell.font = font;
    }
  }
}

/**
 * Format the location header row (Row 16, columns D-E merged)
 * Applies white bold text with fill color #495568
 * @param worksheet - Excel worksheet
 * @param row - Row number (typically 16)
 * @param startCol - Start column (typically 4 for column D)
 * @param endCol - End column (typically 5 for column E)
 */
export function formatLocationHeader(
  worksheet: ExcelJS.Worksheet,
  row: number,
  startCol: number,
  endCol: number
): void {
  // Get the merged cell (D:E) - assume merge already happened in caller
  const mergedCell = worksheet.getCell(row, startCol);
  
  // CRITICAL: Directly set formatting on the merged cell
  // Set fill color FIRST
  mergedCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF495568' } // #495568
  };
  
  // Set font formatting (white, bold)
  mergedCell.font = {
    bold: true,
    size: 11,
    color: { argb: 'FFFFFFFF' } // White
  };
  
  // Set alignment
  mergedCell.alignment = {
    vertical: 'middle',
    wrapText: true
  };
  
  // CRITICAL: Update model.style directly to ensure formatting persists
  const cellModel = (mergedCell as any).model;
  if (cellModel) {
    if (!cellModel.style) {
      cellModel.style = {};
    }
    cellModel.style.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF495568' }
    };
    cellModel.style.font = {
      bold: true,
      size: 11,
      color: { argb: 'FFFFFFFF' }
    };
    cellModel.style.alignment = {
      vertical: 'middle',
      wrapText: true
    };
  }
  
  // Also format individual cells D and E to ensure consistency
  for (let col = startCol; col <= endCol; col++) {
    const individualCell = worksheet.getCell(row, col);
    individualCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF495568' }
    };
    individualCell.font = {
      bold: true,
      size: 11,
      color: { argb: 'FFFFFFFF' }
    };
    individualCell.alignment = {
      vertical: 'middle',
      wrapText: true
    };
    
    // Update model.style for individual cells
    const individualModel = (individualCell as any).model;
    if (individualModel) {
      if (!individualModel.style) {
        individualModel.style = {};
      }
      individualModel.style.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF495568' }
      };
      individualModel.style.font = {
        bold: true,
        size: 11,
        color: { argb: 'FFFFFFFF' }
      };
      individualModel.style.alignment = {
        vertical: 'middle',
        wrapText: true
      };
    }
  }
}

/**
 * Format a subcategory header row
 * Applies white bold text with fill color #495568 to columns D-E only (merged, like location header)
 * @param worksheet - Excel worksheet
 * @param row - Row number
 * @param startCol - Start column (typically 4 for column D)
 * @param endCol - End column (typically 5 for column E)
 */
export function formatSubCategoryHeader(
  worksheet: ExcelJS.Worksheet,
  row: number,
  startCol: number,
  endCol: number
): void {
  // Get the merged cell (D:E) - merge should already be done in caller
  // Use the EXACT same approach as formatLocationHeader (which works)
  const mergedCell = worksheet.getCell(row, startCol);
  
  // CRITICAL: Directly set formatting on the merged cell (same as formatLocationHeader)
  // Set fill color FIRST
  mergedCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF495568' } // #495568
  };
  
  // Set font formatting (white, bold)
  mergedCell.font = {
    bold: true,
    size: 11,
    color: { argb: 'FFFFFFFF' } // White
  };
  
  // Set alignment (with indent for subcategories)
  mergedCell.alignment = {
    vertical: 'middle',
    indent: 1,
    wrapText: true
  };
  
  // CRITICAL: Update model.style directly to ensure formatting persists
  // This is the same approach as formatLocationHeader
  const cellModel = (mergedCell as any).model;
  if (cellModel) {
    if (!cellModel.style) {
      cellModel.style = {};
    }
    cellModel.style.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF495568' }
    };
    cellModel.style.font = {
      bold: true,
      size: 11,
      color: { argb: 'FFFFFFFF' }
    };
    cellModel.style.alignment = {
      vertical: 'middle',
      indent: 1,
      wrapText: true
    };
  }
  
  // Also format individual cells D and E to ensure consistency
  // Same approach as formatLocationHeader
  for (let col = startCol; col <= endCol; col++) {
    const individualCell = worksheet.getCell(row, col);
    individualCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF495568' }
    };
    individualCell.font = {
      bold: true,
      size: 11,
      color: { argb: 'FFFFFFFF' }
    };
    individualCell.alignment = {
      vertical: 'middle',
      indent: 1,
      wrapText: true
    };
    
    // Update model.style for individual cells
    const individualModel = (individualCell as any).model;
    if (individualModel) {
      if (!individualModel.style) {
        individualModel.style = {};
      }
      individualModel.style.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF495568' }
      };
      individualModel.style.font = {
        bold: true,
        size: 11,
        color: { argb: 'FFFFFFFF' }
      };
      individualModel.style.alignment = {
        vertical: 'middle',
        indent: 1,
        wrapText: true
      };
    }
  }
}

