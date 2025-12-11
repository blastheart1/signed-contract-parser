'use client';

import React, { useCallback } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SortDirection } from '@/lib/utils/tableSorting';
import { cn } from '@/lib/utils';

interface SortableTableHeaderProps<T> {
  column: keyof T;
  title: string;
  currentSort: { column: keyof T | null; direction: SortDirection };
  onSortChange: (column: keyof T, direction: SortDirection) => void;
  className?: string;
  showSeparator?: boolean; // Option to show/hide separator
}

/**
 * Lightweight, memoized sortable table header component
 * Uses Select dropdown for sort control (efficient, accessible)
 */
function SortableTableHeader<T>({
  column,
  title,
  currentSort,
  onSortChange,
  className,
  showSeparator = true,
}: SortableTableHeaderProps<T>) {
  const isActive = currentSort.column === column && currentSort.direction !== null;
  const isAsc = currentSort.column === column && currentSort.direction === 'asc';
  const isDesc = currentSort.column === column && currentSort.direction === 'desc';

  // Memoize callback to prevent unnecessary re-renders
  const handleSortChange = useCallback(
    (value: string) => {
      const direction: SortDirection = value === 'none' ? null : (value as 'asc' | 'desc');
      onSortChange(column, direction);
    },
    [column, onSortChange]
  );

  // Determine sort value for Select component
  const sortValue = isActive ? currentSort.direction! : 'none';

  return (
    <TableHead 
      className={cn(
        'relative',
        showSeparator && 'border-r border-border',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span>{title}</span>
        <div className="flex items-center gap-1">
          {/* Sort arrows - shown immediately beside dropdown */}
          <div className="flex items-center">
            {isAsc && <ArrowUp className="h-3.5 w-3.5" />}
            {isDesc && <ArrowDown className="h-3.5 w-3.5" />}
            {!isActive && <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
          <Select value={sortValue} onValueChange={handleSortChange}>
            <SelectTrigger className="h-7 w-[100px] border-0 shadow-none hover:bg-muted/50 focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="asc">Ascending</SelectItem>
              <SelectItem value="desc">Descending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </TableHead>
  );
}

// Memoize component to prevent unnecessary re-renders
export default React.memo(SortableTableHeader) as typeof SortableTableHeader;
