'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface PaginationProps {
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total number of items */
  totalItems: number;
  /** Number of items per page */
  pageSize: number | 'all';
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Callback when page size changes */
  onPageSizeChange: (size: number | 'all') => void;
  /** Available page sizes */
  pageSizeOptions?: number[];
  /** Custom class name */
  className?: string;
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 30, 50],
  className,
}: PaginationProps) {
  // Calculate total pages
  const totalPages = pageSize === 'all' ? 1 : Math.ceil(totalItems / pageSize);
  const effectivePageSize = pageSize === 'all' ? totalItems : pageSize;

  // Calculate display range
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * effectivePageSize + 1;
  const endItem = Math.min(currentPage * effectivePageSize, totalItems);

  // Generate page numbers to display (show max 5 pages around current)
  const getPageNumbers = () => {
    if (totalPages <= 1) return [];
    
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      // Show all pages if total is less than max
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      // Calculate range around current page
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      
      // Adjust if we're near the start
      if (currentPage <= 3) {
        end = Math.min(4, totalPages - 1);
      }
      
      // Adjust if we're near the end
      if (currentPage >= totalPages - 2) {
        start = Math.max(totalPages - 3, 2);
      }
      
      // Add ellipsis before range if needed
      if (start > 2) {
        pages.push('...');
      }
      
      // Add page numbers in range
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      // Add ellipsis after range if needed
      if (end < totalPages - 1) {
        pages.push('...');
      }
      
      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const pageNumbers = getPageNumbers();

  const handlePageSizeChange = (value: string) => {
    if (value === 'all') {
      onPageSizeChange('all');
      onPageChange(1); // Reset to first page
    } else {
      const size = parseInt(value, 10);
      onPageSizeChange(size);
      // Recalculate page to ensure it's valid
      const newTotalPages = Math.ceil(totalItems / size);
      if (currentPage > newTotalPages && newTotalPages > 0) {
        onPageChange(newTotalPages);
      } else {
        onPageChange(1);
      }
    }
  };

  if (totalItems === 0) {
    return null;
  }

  return (
    <div className={cn('flex items-center justify-between px-2 py-4', className)}>
      {/* Left side: Page size selector and item count */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Show</span>
          <Select
            value={pageSize === 'all' ? 'all' : pageSize.toString()}
            onValueChange={handlePageSizeChange}
          >
            <SelectTrigger className="w-[80px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">per page</span>
        </div>
        <div className="text-sm text-muted-foreground">
          Showing {startItem} to {endItem} of {totalItems} {totalItems === 1 ? 'item' : 'items'}
        </div>
      </div>

      {/* Right side: Page navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-8"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Previous page</span>
        </Button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((page, index) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${index}`} className="px-2 text-sm text-muted-foreground">
                  ...
                </span>
              );
            }

            const pageNum = page as number;
            return (
              <Button
                key={pageNum}
                variant={currentPage === pageNum ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                className="h-8 w-8"
              >
                {pageNum}
              </Button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="h-8"
        >
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Next page</span>
        </Button>
      </div>
    </div>
  );
}

