'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Users, CheckCircle2, Clock } from 'lucide-react';

interface RepPerformance {
  repName: string;
  totalSales: number;
  orderCount: number;
  completedCount: number;
  pendingCount: number;
  averageOrderValue: number;
  completionRate: number;
}

interface SalesPerformanceData {
  repPerformance: RepPerformance[];
  totals: {
    totalSales: number;
    totalOrders: number;
    totalCompleted: number;
    totalPending: number;
  };
  monthComparison: {
    thisMonth: number;
    lastMonth: number;
    change: number;
    changePercent: number;
  } | null;
  period: string;
}

export default function SalesPerformanceCard() {
  const [data, setData] = useState<SalesPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'all' | 'month'>('all');

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/dashboard/sales-performance?period=${period}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch sales performance');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales Performance by Rep</CardTitle>
          <CardDescription>Individual sales rep performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales Performance by Rep</CardTitle>
          <CardDescription>Individual sales rep performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-destructive">{error || 'Failed to load data'}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Sales Performance by Rep
            </CardTitle>
            <CardDescription>Individual sales rep performance metrics</CardDescription>
          </div>
          <Select value={period} onValueChange={(value) => setPeriod(value as 'all' | 'month')}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Totals */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Total Sales</div>
            <div className="text-xl font-bold">
              ${data.totals.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Total Orders</div>
            <div className="text-xl font-bold">{data.totals.totalOrders}</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Completed</div>
            <div className="text-xl font-bold text-green-600">{data.totals.totalCompleted}</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Pending</div>
            <div className="text-xl font-bold text-yellow-600">{data.totals.totalPending}</div>
          </div>
        </div>

        {/* Month Comparison */}
        {data.monthComparison && (
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Month-over-Month</div>
                <div className="text-lg font-semibold">
                  {data.monthComparison.changePercent >= 0 ? '+' : ''}
                  {data.monthComparison.changePercent.toFixed(1)}%
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">This Month</div>
                <div className="text-lg font-semibold">
                  ${data.monthComparison.thisMonth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-muted-foreground">
                  Last Month: ${data.monthComparison.lastMonth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rep Performance Table */}
        <div>
          <h4 className="text-sm font-semibold mb-3">Performance by Rep</h4>
          <div className="space-y-2">
            {data.repPerformance.map((rep, index) => (
              <div
                key={rep.repName}
                className="p-4 border rounded-lg hover:bg-accent"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-6">{index + 1}.</span>
                    <span className="font-semibold">{rep.repName}</span>
                  </div>
                  <Badge variant={rep.completionRate >= 80 ? 'default' : 'secondary'}>
                    {rep.completionRate.toFixed(1)}% Complete
                  </Badge>
                </div>
                <div className="grid grid-cols-4 gap-4 mt-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Total Sales</div>
                    <div className="text-sm font-semibold">
                      ${rep.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Orders</div>
                    <div className="text-sm font-semibold">{rep.orderCount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Avg Order Value</div>
                    <div className="text-sm font-semibold">
                      ${rep.averageOrderValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Status</div>
                    <div className="flex gap-1 text-xs">
                      <Badge variant="outline" className="text-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {rep.completedCount}
                      </Badge>
                      <Badge variant="outline" className="text-yellow-600">
                        <Clock className="h-3 w-3 mr-1" />
                        {rep.pendingCount}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

