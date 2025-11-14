import { Location } from './tableExtractor';

/**
 * Format client name as "First Initial. Last Name"
 * Example: "Ely Przybyl" -> "E. Przybyl"
 * @param clientName - Full client name
 * @returns Formatted client name
 */
function formatClientName(clientName: string): string {
  if (!clientName || clientName.trim().length === 0) {
    return '';
  }

  const trimmed = clientName.trim();
  const parts = trimmed.split(/\s+/);

  if (parts.length === 0) {
    return '';
  }

  if (parts.length === 1) {
    // Only one name part, return as-is
    return parts[0];
  }

  // First name initial + Last name
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  const firstInitial = firstName.charAt(0).toUpperCase();

  return `${firstInitial}. ${lastName}`;
}

/**
 * Sanitize filename for filesystem compatibility
 * Removes invalid characters and limits length
 * @param filename - Filename to sanitize
 * @returns Sanitized filename
 */
function sanitizeFilename(filename: string): string {
  // Remove invalid characters for filenames: < > : " / \ | ? *
  let sanitized = filename.replace(/[<>:"/\\|?*]/g, '');
  
  // Remove leading/trailing spaces and dots
  sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '');
  
  // Replace multiple spaces with single space
  sanitized = sanitized.replace(/\s+/g, ' ');
  
  // Limit filename length to 255 characters (common filesystem limit)
  // Reserve space for .xlsx extension
  if (sanitized.length > 247) {
    sanitized = sanitized.substring(0, 247);
    // Remove trailing spaces or dashes
    sanitized = sanitized.replace(/[\s-]+$/, '');
  }
  
  return sanitized;
}

/**
 * Generate filename for spreadsheet based on location data
 * Format: "{Client Initial Last Name} - #{DBX Customer ID} - {Address}.xlsx"
 * Example: "E. Przybyl - #9682 - 1041 Temple terrace.xlsx"
 * @param location - Location object with client info
 * @returns Generated filename
 */
export function generateSpreadsheetFilename(location: Location): string {
  const parts: string[] = [];

  // Format client name (First Initial. Last Name)
  if (location.clientName) {
    const formattedClientName = formatClientName(location.clientName);
    if (formattedClientName) {
      parts.push(formattedClientName);
    }
  }

  // Add DBX Customer ID with # prefix
  if (location.dbxCustomerId) {
    parts.push(`#${location.dbxCustomerId}`);
  }

  // Add street address
  if (location.streetAddress) {
    parts.push(location.streetAddress);
  }

  // If we have no parts, use a fallback
  if (parts.length === 0) {
    // Fallback: Use order number if available
    if (location.orderNo) {
      return sanitizeFilename(`Contract - #${location.orderNo}.xlsx`);
    }
    // Final fallback: timestamp
    return `contract-${Date.now()}.xlsx`;
  }

  // Join parts with " - " separator
  let filename = parts.join(' - ');

  // Sanitize the filename
  filename = sanitizeFilename(filename);

  // Add .xlsx extension
  return `${filename}.xlsx`;
}

