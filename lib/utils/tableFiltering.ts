/**
 * Pure filtering utilities for tables
 * Performance-optimized with Set-based lookups
 */

export interface ColumnFilter<T> {
  column: keyof T;
  values: Set<string | number | null>;
}

export interface FilterState {
  stage?: Set<string | null>;
  status?: Set<string | null>;
  // Can be extended for other columns
}

/**
 * Efficiently filter an array of items
 * Uses Set for O(1) lookup performance
 * 
 * @param data - Array to filter
 * @param filters - Filter state object
 * @returns New filtered array (original array unchanged)
 */
export function filterData<T>(
  data: T[],
  filters: FilterState,
  getStageValue: (item: T) => string | null,
  getStatusValue: (item: T) => string | null
): T[] {
  // Early return if no filters active
  const hasStageFilter = filters.stage && filters.stage.size > 0;
  const hasStatusFilter = filters.status && filters.status.size > 0;

  if (!hasStageFilter && !hasStatusFilter) {
    return data;
  }

  // Single pass filter with early exits
  return data.filter((item) => {
    // Stage filter with early exit
    if (hasStageFilter) {
      const itemStage = getStageValue(item);
      if (!filters.stage!.has(itemStage)) {
        return false;
      }
    }

    // Status filter with early exit
    if (hasStatusFilter) {
      const itemStatus = getStatusValue(item);
      if (!filters.status!.has(itemStatus)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Convert array of filter values to Set for efficient lookups
 */
export function arrayToFilterSet(values: (string | null)[] | undefined): Set<string | null> | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }
  return new Set(values);
}

/**
 * Check if any filters are active
 */
export function hasActiveFilters(filters: FilterState): boolean {
  return !!(
    (filters.stage && filters.stage.size > 0) ||
    (filters.status && filters.status.size > 0)
  );
}

/**
 * Clear all filters
 */
export function clearAllFilters(): FilterState {
  return {};
}
