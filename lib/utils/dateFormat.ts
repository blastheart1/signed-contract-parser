/**
 * Date format conversion utilities
 * Handles conversion between MM/DD/YYYY (storage format) and YYYY-MM-DD (HTML5 date input format)
 */

/**
 * Convert MM/DD/YYYY format to YYYY-MM-DD format for HTML5 date input
 * @param mmddyyyy - Date string in MM/DD/YYYY format or null/undefined
 * @returns Date string in YYYY-MM-DD format, or empty string if input is invalid/null
 */
export function mmddyyyyToYyyymmdd(mmddyyyy: string | null | undefined): string {
  if (!mmddyyyy || typeof mmddyyyy !== 'string') {
    return '';
  }

  // Validate MM/DD/YYYY format (with leading zeros)
  const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;
  if (!dateRegex.test(mmddyyyy.trim())) {
    // Try to parse even if format is slightly off (e.g., missing leading zeros)
    const parts = mmddyyyy.trim().split('/');
    if (parts.length === 3) {
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2];
      const normalized = `${month}/${day}/${year}`;
      if (dateRegex.test(normalized)) {
        return `${year}-${month}-${day}`;
      }
    }
    return '';
  }

  // Extract parts
  const [month, day, year] = mmddyyyy.trim().split('/');
  return `${year}-${month}-${day}`;
}

/**
 * Convert YYYY-MM-DD format to MM/DD/YYYY format for storage
 * @param yyyymmdd - Date string in YYYY-MM-DD format
 * @returns Date string in MM/DD/YYYY format, or null if input is invalid
 */
export function yyyymmddToMmddyyyy(yyyymmdd: string): string | null {
  if (!yyyymmdd || typeof yyyymmdd !== 'string') {
    return null;
  }

  // Validate YYYY-MM-DD format
  const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
  if (!dateRegex.test(yyyymmdd.trim())) {
    return null;
  }

  // Extract parts and convert to MM/DD/YYYY
  const [year, month, day] = yyyymmdd.trim().split('-');
  return `${month}/${day}/${year}`;
}

/**
 * Format date string for display (MM/DD/YYYY format or fallback)
 * @param dateString - Date string in MM/DD/YYYY format or null/undefined
 * @returns Formatted date string or "-" for null/empty/invalid dates
 */
export function formatDateForDisplay(dateString: string | null | undefined): string {
  if (!dateString || typeof dateString !== 'string') {
    return '-';
  }

  // Validate MM/DD/YYYY format
  const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;
  if (dateRegex.test(dateString.trim())) {
    return dateString.trim();
  }

  // Try to parse and format if it's a valid date
  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    }
  } catch {
    // Invalid date, return original or fallback
  }

  return dateString.trim() || '-';
}

/**
 * Normalize various date formats to MM/DD/YYYY format
 * Handles formats like "3/25/2025", "03/25/2025", "0", ISO dates, etc.
 * @param dateString - Date string in various formats or null/undefined
 * @returns Date string in MM/DD/YYYY format with leading zeros, or null if invalid
 */
export function normalizeToMmddyyyy(dateString: string | null | undefined): string | null {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }

  const trimmed = dateString.trim();
  
  // Handle "0" or empty strings
  if (trimmed === '0' || trimmed === '') {
    return null;
  }

  // If already in MM/DD/YYYY format (with or without leading zeros), normalize it
  const mmddyyyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = trimmed.match(mmddyyyyPattern);
  if (match) {
    const month = match[1].padStart(2, '0');
    const day = match[2].padStart(2, '0');
    const year = match[3];
    
    // Validate the date
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    const yearNum = parseInt(year, 10);
    
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31 && yearNum >= 1900 && yearNum <= 2100) {
      return `${month}/${day}/${year}`;
    }
  }

  // Try to parse as ISO date (YYYY-MM-DD)
  const isoPattern = /^(\d{4})-(\d{1,2})-(\d{1,2})/;
  const isoMatch = trimmed.match(isoPattern);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    const yearNum = parseInt(year, 10);
    
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31 && yearNum >= 1900 && yearNum <= 2100) {
      return `${month}/${day}/${year}`;
    }
  }

  // Try to parse as Date object
  try {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      
      // Validate reasonable year range
      if (year >= 1900 && year <= 2100) {
        return `${month}/${day}/${year}`;
      }
    }
  } catch {
    // Invalid date, return null
  }

  return null;
}
