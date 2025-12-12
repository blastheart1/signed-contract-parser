'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFloating, offset, flip, shift, autoUpdate } from '@floating-ui/react';
import { Filter, X } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FilterableTableHeaderTextProps {
  title: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showSeparator?: boolean;
  width?: string;
}

/**
 * Filterable table header with text input for filtering
 * View-only filtering that doesn't affect data order or spreadsheet generation
 * Mobile-optimized with portal rendering
 */
function FilterableTableHeaderText({
  title,
  value,
  onChange,
  placeholder = 'Filter...',
  className,
  showSeparator = true,
  width,
}: FilterableTableHeaderTextProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ensure we're mounted (client-side) before using portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Focus input when popup opens
  useEffect(() => {
    if (isOpen && inputRef.current && mounted) {
      // Small delay to ensure portal is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, mounted]);

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

  const hasActiveFilter = value.trim().length > 0;

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  return (
    <TableHead 
      className={cn(
        'relative',
        showSeparator && 'border-r border-black',
        width,
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 h-8">
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
                1
              </Badge>
            )}
          </Button>

          {isOpen && mounted &&
            createPortal(
              <div
                ref={refs.setFloating}
                style={floatingStyles}
                className="z-[100] w-full sm:w-64 max-w-[calc(100vw-2rem)] sm:max-w-none rounded-md border bg-popover shadow-md p-3"
              >
                <div className="space-y-3">
                  {/* Header with X close button */}
                  <div className="flex items-center justify-between pb-2 border-b">
                    <Label className="text-xs sm:text-sm font-semibold">Filter {title}</Label>
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

                  {/* Text input */}
                  <div className="space-y-2">
                    <Input
                      ref={inputRef}
                      type="text"
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      placeholder={placeholder}
                      className="w-full h-8 sm:h-9 text-xs sm:text-sm"
                    />
                    {hasActiveFilter && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClear}
                        className="w-full h-7 sm:h-8 text-xs sm:text-sm"
                      >
                        Clear Filter
                      </Button>
                    )}
                  </div>

                  {/* Helper text */}
                  <p className="text-xs text-muted-foreground">
                    Filters items by {title.toLowerCase()} (view only)
                  </p>
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
export default React.memo(FilterableTableHeaderText);
