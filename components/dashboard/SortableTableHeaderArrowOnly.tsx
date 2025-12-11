'use client';

import React, { useCallback } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import type { SortDirection } from '@/lib/utils/tableSorting';
import { cn } from '@/lib/utils';

interface SortableTableHeaderArrowOnlyProps<T> {
  column: keyof T;
  title: string;
  currentSort: { column: keyof T | null; direction: SortDirection };
  onSortChange: (column: keyof T, direction: SortDirection) => void;
  className?: string;
  showSeparator?: boolean;
  width?: string; // Optional width constraint (e.g., "w-24", "w-32")
}

/**
 * Sortable header with arrow-only sorting (clickable arrows, no dropdown)
 * Cycles through: None -> Ascending -> Descending -> None
 */
function SortableTableHeaderArrowOnly<T>({
  column,
  title,
  currentSort,
  onSortChange,
  className,
  showSeparator = true,
  width,
}: SortableTableHeaderArrowOnlyProps<T>) {
  const isActive = currentSort.column === column && currentSort.direction !== null;
  const isAsc = currentSort.column === column && currentSort.direction === 'asc';
  const isDesc = currentSort.column === column && currentSort.direction === 'desc';

  // Memoize callback to cycle through sort states
  const handleArrowClick = useCallback(() => {
    let nextDirection: SortDirection;
    if (!isActive) {
      // Currently not sorted, set to ascending
      nextDirection = 'asc';
    } else if (isAsc) {
      // Currently ascending, set to descending
      nextDirection = 'desc';
    } else {
      // Currently descending, set to none
      nextDirection = null;
    }
    onSortChange(column, nextDirection);
  }, [column, isActive, isAsc, onSortChange]);

  return (
    <TableHead 
      className={cn(
        'relative',
        showSeparator && 'border-r border-border',
        width,
        className
      )}
      style={width ? undefined : {}}
    >
      <div className="flex items-center justify-between gap-2">
        <span>{title}</span>
        <button
          onClick={handleArrowClick}
          className="flex items-center hover:bg-muted/50 rounded p-1 transition-colors"
          aria-label={`Sort ${title}`}
        >
          {isAsc && <ArrowUp className="h-3.5 w-3.5" />}
          {isDesc && <ArrowDown className="h-3.5 w-3.5" />}
          {!isActive && <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      </div>
    </TableHead>
  );
}

// Memoize component to prevent unnecessary re-renders
export default React.memo(SortableTableHeaderArrowOnly) as typeof SortableTableHeaderArrowOnly;
