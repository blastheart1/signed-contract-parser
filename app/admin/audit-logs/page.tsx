'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, FileSearch, Calendar, User } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

interface AuditLogEntry {
  id: string;
  changeType: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  rowIndex: number | null;
  changedAt: string;
  changedBy: {
    id: string | null;
    username: string;
  };
  customer: {
    dbxCustomerId: string;
    clientName: string;
  } | null;
  order: {
    id: string;
    orderNo: string;
  } | null;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'all'>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchLogs = async (reset = false) => {
    setLoading(true);
    try {
      const currentPage = reset ? 1 : page;
      const response = await fetch(`/api/timeline?period=${period}&page=${currentPage}&limit=${limit}`);
      const data = await response.json();

      if (data.success) {
        if (reset) {
          setLogs(data.changes);
          setPage(1);
        } else {
          setLogs((prev) => [...prev, ...data.changes]);
        }
        setHasMore(data.hasMore);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const handleLoadMore = () => {
    setPage((prev) => prev + 1);
    fetchLogs(false);
  };

  const getChangeTypeBadge = (changeType: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      cell_edit: 'default',
      row_add: 'secondary',
      row_delete: 'destructive',
      row_update: 'outline',
      customer_edit: 'default',
      order_edit: 'default',
    };
    return (
      <Badge variant={variants[changeType] || 'outline'}>
        {changeType.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground mt-2">
          View all system changes and activities
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <FileSearch className="h-5 w-5" />
                Activity Log
              </CardTitle>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={period} onValueChange={(value) => setPeriod(value as typeof period)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <Calendar className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="month">Last 30 Days</SelectItem>
                    <SelectItem value="week">Last 7 Days</SelectItem>
                    <SelectItem value="day">Today</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => fetchLogs(true)}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading && logs.length === 0 ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12">
                <FileSearch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No audit logs found</p>
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-muted-foreground">
                  Showing {logs.length} of {total} entries
                </div>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[120px]">Date & Time</TableHead>
                          <TableHead className="min-w-[100px]">User</TableHead>
                          <TableHead className="min-w-[120px]">Type</TableHead>
                          <TableHead className="min-w-[150px]">Field</TableHead>
                          <TableHead className="min-w-[200px]">Customer</TableHead>
                          <TableHead className="min-w-[120px]">Order</TableHead>
                          <TableHead className="min-w-[150px]">Changes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm">
                              {formatDate(log.changedAt)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{log.changedBy.username}</span>
                              </div>
                            </TableCell>
                            <TableCell>{getChangeTypeBadge(log.changeType)}</TableCell>
                            <TableCell className="text-sm">
                              {log.fieldName || '-'}
                            </TableCell>
                            <TableCell>
                              {log.customer ? (
                                <Link
                                  href={`/dashboard/customers/${log.customer.dbxCustomerId}`}
                                  className="text-primary hover:underline"
                                >
                                  {log.customer.clientName}
                                </Link>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {log.order ? (
                                <Link
                                  href={`/dashboard/customers/${log.customer?.dbxCustomerId || ''}`}
                                  className="text-primary hover:underline"
                                >
                                  #{log.order.orderNo}
                                </Link>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              {log.oldValue && log.newValue ? (
                                <div className="space-y-1">
                                  <div className="text-red-600 line-through">
                                    {log.oldValue.length > 30
                                      ? `${log.oldValue.substring(0, 30)}...`
                                      : log.oldValue}
                                  </div>
                                  <div className="text-green-600">
                                    {log.newValue.length > 30
                                      ? `${log.newValue.substring(0, 30)}...`
                                      : log.newValue}
                                  </div>
                                </div>
                              ) : log.newValue ? (
                                <span className="text-green-600">
                                  {log.newValue.length > 50
                                    ? `${log.newValue.substring(0, 50)}...`
                                    : log.newValue}
                                </span>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                {hasMore && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      onClick={handleLoadMore}
                      disabled={loading}
                      variant="outline"
                      className="min-h-[44px]"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        'Load More'
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

