'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useFloating, offset, flip, shift, autoUpdate } from '@floating-ui/react';
import { Filter, X } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FilterOption {
  value: string | null;
  label: string;
}

interface FilterableTableHeaderProps {
  title: string;
  options: FilterOption[];
  selectedValues: Set<string | null>;
  onFilterChange: (values: Set<string | null>) => void;
  className?: string;
  showSeparator?: boolean; // Option to show/hide separator
  width?: string; // Optional width constraint (e.g., "w-24", "w-32")
}

/**
 * Lightweight filterable table header with Excel-style dropdown
 * Efficient multi-select with checkboxes
 */
function FilterableTableHeader({
  title,
  options,
  selectedValues,
  onFilterChange,
  className,
  showSeparator = true,
  width,
}: FilterableTableHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Ensure we're mounted (client-side) before using portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Floating UI positioning hook with fixed strategy for portal
  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(8), // 8px gap between button and popup
      flip(), // Automatically flip to left side if right side overflows
      shift({ padding: 8 }), // Shift within viewport with 8px padding from edges
    ],
    whileElementsMounted: autoUpdate, // Auto-update position on scroll/resize
    strategy: 'fixed', // Required for portal - uses fixed positioning relative to viewport
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      
      // Use the actual DOM elements from the refs
      const referenceEl = refs.reference.current as HTMLElement | null;
      const floatingEl = refs.floating.current as HTMLElement | null;
      
      // Close if click is outside both the button and the popup
      if (
        isOpen &&
        referenceEl &&
        floatingEl &&
        !referenceEl.contains(target) &&
        !floatingEl.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, refs]);

  const hasActiveFilter = selectedValues.size > 0;

  // Memoized handlers
  const handleToggleOption = useCallback(
    (value: string | null) => {
      const newValues = new Set(selectedValues);
      if (newValues.has(value)) {
        newValues.delete(value);
      } else {
        newValues.add(value);
      }
      onFilterChange(newValues);
    },
    [selectedValues, onFilterChange]
  );

  const handleSelectAll = useCallback(() => {
    const allValues = new Set(options.map((opt) => opt.value));
    onFilterChange(allValues);
  }, [options, onFilterChange]);

  const handleClearAll = useCallback(() => {
    onFilterChange(new Set());
  }, [onFilterChange]);

  const allSelected = options.every((opt) => selectedValues.has(opt.value));

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
        <div className="relative">
          <Button
            ref={refs.setReference}
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 w-7 p-0',
              hasActiveFilter && 'bg-primary/10 text-primary hover:bg-primary/20'
            )}
            onClick={() => setIsOpen(!isOpen)}
            aria-label={`Filter ${title}`}
          >
            <Filter className="h-3.5 w-3.5" />
            {hasActiveFilter && (
              <Badge
                variant="secondary"
                className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
              >
                {selectedValues.size}
              </Badge>
            )}
          </Button>

          {isOpen && mounted &&
            createPortal(
              <div
                ref={refs.setFloating}
                style={floatingStyles}
                className="z-[100] w-full sm:w-44 max-w-[calc(100vw-2rem)] sm:max-w-none rounded-md border bg-popover shadow-md p-2"
              >
                <div className="space-y-2">
                  {/* Header with X close button */}
                  <div className="flex items-center justify-between pb-2 border-b">
                    <Label className="text-xs sm:text-sm font-semibold">Filter Options</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 sm:h-8 sm:w-8 p-0"
                      onClick={() => setIsOpen(false)}
                      aria-label="Close filter"
                    >
                      <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                  </div>

                  {/* Clear button above options */}
                  <div className="pb-1 border-b">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAll}
                      className="w-full justify-start h-7 sm:h-8 text-xs sm:text-sm py-2"
                    >
                      Clear
                    </Button>
                  </div>

                  {/* Scrollable options list - all left-aligned */}
                  <div className="max-h-[200px] overflow-y-auto space-y-1">
                    <div
                      className="flex items-center justify-start space-x-2 sm:space-x-3 px-1 py-1 sm:py-2 hover:bg-muted rounded cursor-pointer"
                      onClick={handleSelectAll}
                    >
                      <Checkbox checked={allSelected} />
                      <Label className="text-xs sm:text-sm font-medium cursor-pointer text-left">Select All</Label>
                    </div>
                    {options.map((option) => {
                      const isChecked = selectedValues.has(option.value);
                      return (
                        <div
                          key={option.value ?? 'null'}
                          className="flex items-center justify-start space-x-2 sm:space-x-3 px-1 py-1 sm:py-2 hover:bg-muted rounded cursor-pointer"
                          onClick={() => handleToggleOption(option.value)}
                        >
                          <Checkbox checked={isChecked} />
                          <Label className="text-xs sm:text-sm cursor-pointer flex-1 text-left">{option.label}</Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>,
              document.body
            )}
        </div>
      </div>
    </TableHead>
  );
}

// Memoize component to prevent unnecessary re-renders
export default React.memo(FilterableTableHeader);
