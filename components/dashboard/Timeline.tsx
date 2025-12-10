'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Search,
  X,
  Filter,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { TimelineEntry, TimelineFilter, TimelineResponse } from '@/lib/types/timeline';
import Link from 'next/link';

interface User {
  id: string;
  username: string;
}

interface Customer {
  dbxCustomerId: string;
  clientName: string;
}

export default function Timeline() {
  const [changes, setChanges] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<TimelineFilter>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const limit = 10;
  
  // Filter states
  const [changeType, setChangeType] = useState<string>('all');
  const [userId, setUserId] = useState<string>('all');
  const [customerId, setCustomerId] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  
  // Filter options
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(false);

  // Fetch filter options
  useEffect(() => {
    const fetchFilterOptions = async () => {
      setLoadingFilters(true);
      try {
        // Fetch users
        const usersResponse = await fetch('/api/admin/users');
        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          if (usersData.success) {
            setUsers(usersData.users.filter((u: User) => u.id)); // Filter out nulls
          }
        }
        
        // Fetch customers (we'll need to create an endpoint or use existing one)
        // For now, we'll skip customers filter options and let users type the ID
      } catch (error) {
        console.error('Error fetching filter options:', error);
      } finally {
        setLoadingFilters(false);
      }
    };
    
    fetchFilterOptions();
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [search]);

  const fetchTimeline = async (reset = false) => {
    setLoading(true);
    try {
      const currentPage = reset ? 1 : page;
      const params = new URLSearchParams({
        period,
        page: currentPage.toString(),
        limit: limit.toString(),
      });
      
      if (changeType && changeType !== 'all') params.append('changeType', changeType);
      if (userId && userId !== 'all') params.append('userId', userId);
      if (customerId && customerId.trim()) params.append('customerId', customerId.trim());
      if (debouncedSearch) params.append('search', debouncedSearch);
      
      const response = await fetch(`/api/timeline?${params.toString()}`);
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
      console.error('Error fetching timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, changeType, userId, customerId, debouncedSearch]);
  
  const clearFilters = () => {
    setChangeType('all');
    setUserId('all');
    setCustomerId('');
    setSearch('');
    setDebouncedSearch('');
  };
  
  const hasActiveFilters = (changeType && changeType !== 'all') || (userId && userId !== 'all') || customerId || search;

  const handleLoadMore = () => {
    setPage((prev) => prev + 1);
    fetchTimeline(false);
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
        return <Edit className="h-4 w-4 text-blue-600" />;
      case 'row_add':
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'row_delete':
        return <Trash2 className="h-4 w-4 text-red-600" />;
      case 'row_update':
        return <RefreshCw className="h-4 w-4 text-amber-600" />;
      case 'customer_edit':
        return <User className="h-4 w-4 text-purple-600" />;
      case 'order_edit':
        return <Edit className="h-4 w-4 text-cyan-600" />;
      default:
        return <Edit className="h-4 w-4 text-blue-600" />;
    }
  };

  const getChangeTypeBadgeColor = (changeType: TimelineEntry['changeType']): string => {
    switch (changeType) {
      case 'cell_edit':
        return 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300';
      case 'row_add':
        return 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300';
      case 'row_delete':
        return 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300';
      case 'row_update':
        return 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300';
      case 'customer_edit':
        return 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300';
      case 'order_edit':
        return 'bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-900/30 dark:text-cyan-300';
      default:
        return 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300';
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
    const { changeType, fieldName, customer, order } = entry;
    const entity = order ? `Order #${order.orderNo}` : customer ? customer.clientName : 'Record';
    
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

  const formatDateHeader = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const entryDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    
    if (entryDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (entryDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    } else {
      const diffTime = today.getTime() - entryDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) {
        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      } else {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }
  };

  const groupEntriesByDate = (entries: TimelineEntry[]): Map<string, TimelineEntry[]> => {
    const groups = new Map<string, TimelineEntry[]>();
    
    entries.forEach(entry => {
      const dateKey = formatDateHeader(entry.changedAt);
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(entry);
    });
    
    return groups;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Timeline</CardTitle>
            <CardDescription>All changes across the system</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => fetchTimeline(true)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Select value={period} onValueChange={(value) => setPeriod(value as TimelineFilter)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="day">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <div className="px-6 pt-0 pb-4">
        {/* Filters and Search */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by field name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
            {search && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => setSearch('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <Select value={changeType} onValueChange={setChangeType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Change Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="cell_edit">Cell Edit</SelectItem>
              <SelectItem value="row_add">Row Add</SelectItem>
              <SelectItem value="row_delete">Row Delete</SelectItem>
              <SelectItem value="row_update">Row Update</SelectItem>
              <SelectItem value="customer_edit">Customer Edit</SelectItem>
              <SelectItem value="order_edit">Order Edit</SelectItem>
            </SelectContent>
          </Select>
          <Select value={userId} onValueChange={setUserId} disabled={loadingFilters}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="User" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Customer ID (DBX)"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-40"
          />
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>
      <CardContent>
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
            <div className="relative max-w-4xl mx-auto">
              {/* Vertical line in center */}
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-border transform -translate-x-1/2 hidden md:block" />

            <div className="space-y-8">
              {Array.from(groupEntriesByDate(changes).entries()).map(([dateHeader, dateEntries]) => (
                <div key={dateHeader} className="space-y-6">
                  {/* Date Header */}
                  <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm py-2 -mt-2">
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 bg-border" />
                      <h3 className="text-sm font-semibold text-green-600 px-3">
                        {dateHeader}
                      </h3>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  </div>

                  {/* Entries for this date */}
                  {dateEntries.map((entry, index) => {
                    const isExpanded = expandedIds.has(entry.id);
                    const isLeft = index % 2 === 0;

                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className={`relative flex items-start justify-center ${isLeft ? 'md:justify-start' : 'md:justify-end'}`}
                  >
                    {/* Circle on line */}
                    <div className="absolute left-1/2 top-2 w-4 h-4 rounded-full bg-primary border-2 border-background z-10 transform -translate-x-1/2 hidden md:block" />

                    {/* Card */}
                    <div className={`w-full ${isLeft ? 'md:pr-8' : 'md:pl-8'}`} style={{ maxWidth: '600px' }}>
                      <div
                        className="bg-card border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => toggleExpand(entry.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <div>{getChangeTypeIcon(entry.changeType)}</div>
                              <Badge variant="outline" className={`text-xs ${getChangeTypeBadgeColor(entry.changeType)}`}>
                                {getChangeTypeLabel(entry.changeType)}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {entry.changedBy.username}
                              </span>
                            </div>
                            <p className="text-sm font-medium mb-1">{formatSummary(entry)}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1 text-green-600 font-medium">
                                <Calendar className="h-3 w-3" />
                                {formatDate(entry.changedAt)}
                              </span>
                              {entry.customer && (
                                <Link
                                  href={`/dashboard/customers/${entry.customer.dbxCustomerId}`}
                                  className="text-primary hover:underline flex items-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  DBX: {entry.customer.dbxCustomerId}
                                </Link>
                              )}
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
                                <Link
                                  href={`/dashboard/customers/${entry.customer?.dbxCustomerId}`}
                                  className="text-primary hover:underline ml-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {entry.order.orderNo}
                                </Link>
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
              ))}
            </div>

            {/* Load More button */}
            {hasMore && (
              <div className="mt-6 text-center relative z-10 bg-background">
                <Button variant="outline" onClick={handleLoadMore} disabled={loading} className="opacity-100">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Loading...
                    </>
                  ) : (
                    <>
                      Load More
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

