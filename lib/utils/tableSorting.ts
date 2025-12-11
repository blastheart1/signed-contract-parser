/**
 * Pure sorting utilities for tables
 * Performance-optimized, no React dependencies
 */

export type SortDirection = 'asc' | 'desc' | null;

export interface SortState<T> {
  column: keyof T | null;
  direction: SortDirection;
}

/**
 * Efficiently sort an array of items
 * @param data - Array to sort
 * @param sortState - Current sort state
 * @param getValue - Function to extract sort value from item
 * @returns New sorted array (original array unchanged)
 */
export function sortData<T>(
  data: T[],
  sortState: SortState<T>,
  getValue: (item: T, column: keyof T) => any
): T[] {
  // Early return - avoid unnecessary array copy if no sort
  if (!sortState.column || !sortState.direction) {
    return data;
  }

  // Create single array copy (avoid multiple copies)
  const sorted = [...data];

  // Use efficient native sort with optimized comparator
  sorted.sort((a, b) => {
    const aValue = getValue(a, sortState.column!);
    const bValue = getValue(b, sortState.column!);

    // Handle nulls/undefined efficiently (nulls always go to end)
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return 1;
    if (bValue == null) return -1;

    // Type-aware comparison for better performance
    let comparison = 0;
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      // Case-insensitive string comparison
      comparison = aValue.localeCompare(bValue, undefined, { sensitivity: 'base' });
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
      // Direct numeric comparison
      comparison = aValue - bValue;
    } else {
      // Fallback: convert to string (less common, slower)
      comparison = String(aValue).localeCompare(String(bValue));
    }

    return sortState.direction === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Helper to extract value from nested object paths
 * Supports dot notation like "address.city"
 */
export function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, prop) => current?.[prop], obj);
}

/**
 * Create a sort value extractor for a specific column
 * Handles different column types efficiently
 */
export function createSortValueExtractor<T>(
  column: keyof T,
  transform?: (value: any) => any
): (item: T) => any {
  return (item: T) => {
    const value = item[column];
    return transform ? transform(value) : value;
  };
}
