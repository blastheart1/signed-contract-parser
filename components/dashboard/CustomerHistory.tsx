'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Edit,
  Plus,
  Trash2,
  RefreshCw,
  User,
  Calendar,
  ChevronDown,
  ChevronRight,
  Loader2,
  X,
} from 'lucide-react';
import type { TimelineEntry, TimelineFilter, TimelineResponse } from '@/lib/types/timeline';
import Link from 'next/link';

interface CustomerHistoryProps {
  customerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CustomerHistory({ customerId, open, onOpenChange }: CustomerHistoryProps) {
  const [changes, setChanges] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<TimelineFilter>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const limit = 10;

  const fetchHistory = async (reset = false) => {
    setLoading(true);
    try {
      const currentPage = reset ? 1 : page;
      const response = await fetch(
        `/api/customers/${customerId}/history?period=${period}&page=${currentPage}&limit=${limit}`
      );
      const data: TimelineResponse = await response.json();

      if (data.success) {
        if (reset) {
          setChanges(data.changes);
          setPage(1);
        } else {
          setChanges((prev) => [...prev, ...data.changes]);
        }
        setHasMore(data.hasMore);
      }
    } catch (error) {
      console.error('Error fetching customer history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && customerId) {
      fetchHistory(true);
    }
  }, [open, customerId, period]);

  const handleLoadMore = () => {
    setPage((prev) => prev + 1);
    fetchHistory(false);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getChangeTypeIcon = (changeType: TimelineEntry['changeType']) => {
    switch (changeType) {
      case 'cell_edit':
        return <Edit className="h-4 w-4" />;
      case 'row_add':
        return <Plus className="h-4 w-4" />;
      case 'row_delete':
        return <Trash2 className="h-4 w-4" />;
      case 'row_update':
        return <RefreshCw className="h-4 w-4" />;
      case 'customer_edit':
        return <User className="h-4 w-4" />;
      case 'order_edit':
        return <Edit className="h-4 w-4" />;
      default:
        return <Edit className="h-4 w-4" />;
    }
  };

  const getChangeTypeLabel = (changeType: TimelineEntry['changeType']) => {
    switch (changeType) {
      case 'cell_edit':
        return 'Edited';
      case 'row_add':
        return 'Added';
      case 'row_delete':
        return 'Deleted';
      case 'row_update':
        return 'Updated';
      case 'customer_edit':
        return 'Customer Updated';
      case 'order_edit':
        return 'Order Updated';
      default:
        return 'Changed';
    }
  };

  const formatSummary = (entry: TimelineEntry): string => {
    const { changeType, fieldName, order } = entry;
    const entity = order ? `Order #${order.orderNo}` : 'Record';

    switch (changeType) {
      case 'cell_edit':
        return `Edited ${fieldName} in ${entity}`;
      case 'row_add':
        return `Added row to ${entity}`;
      case 'row_delete':
        return `Deleted row from ${entity}`;
      case 'row_update':
        return `Updated row in ${entity}`;
      case 'customer_edit':
        return `Updated customer information: ${fieldName}`;
      case 'order_edit':
        return `Updated order information: ${fieldName}`;
      default:
        return `Changed ${fieldName} in ${entity}`;
    }
  };

  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>History</DialogTitle>
          <DialogDescription>Change history for this customer</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between mb-4">
          <Select value={period} onValueChange={(value) => setPeriod(value as TimelineFilter)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="day">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => fetchHistory(true)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {loading && changes.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : changes.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No changes found for the selected period.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border" />

            <div className="space-y-6">
              {changes.map((entry, index) => {
                const isExpanded = expandedIds.has(entry.id);

                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="relative flex items-start"
                  >
                    {/* Circle on line */}
                    <div className="absolute left-6 top-2 w-4 h-4 rounded-full bg-primary border-2 border-background z-10" />

                    {/* Card */}
                    <div className="flex-1 ml-12">
                      <div
                        className="bg-card border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => toggleExpand(entry.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="text-primary">{getChangeTypeIcon(entry.changeType)}</div>
                              <Badge variant="outline" className="text-xs">
                                {getChangeTypeLabel(entry.changeType)}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {entry.changedBy.username}
                              </span>
                            </div>
                            <p className="text-sm font-medium mb-1">{formatSummary(entry)}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(entry.changedAt)}
                              </span>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="ml-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 pt-4 border-t space-y-2"
                          >
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Field:</span>
                                <p className="font-medium">{entry.fieldName}</p>
                              </div>
                              {entry.rowIndex !== null && (
                                <div>
                                  <span className="text-muted-foreground">Row Index:</span>
                                  <p className="font-medium">{entry.rowIndex}</p>
                                </div>
                              )}
                            </div>
                            {(entry.oldValue || entry.newValue) && (
                              <div className="space-y-1">
                                <span className="text-muted-foreground text-sm">Change:</span>
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-destructive line-through">
                                    {entry.oldValue || '(empty)'}
                                  </span>
                                  <span className="text-muted-foreground">→</span>
                                  <span className="text-green-600 font-medium">
                                    {entry.newValue || '(empty)'}
                                  </span>
                                </div>
                              </div>
                            )}
                            {entry.order && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Order:</span>
                                <span className="ml-2">{entry.order.orderNo}</span>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Load More button */}
            {hasMore && (
              <div className="mt-6 text-center">
                <Button variant="outline" onClick={handleLoadMore} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

