'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AnalyticsData {
  overall: {
    totalWorkAssigned: number;
    totalEstimatedCost: number;
    totalActualCost: number;
    totalProfitability: number;
    averageProfitMargin: number;
    totalCostVariance: number;
    averageCostVariancePercentage: number;
    totalItems: number;
    totalProjects: number;
    totalVendors: number;
    totalCategories: number;
  };
  byCategory: Array<{
    category: string;
    totalWorkAssigned: number;
    totalEstimatedCost: number;
    totalActualCost: number;
    totalProfitability: number;
    averageProfitMargin: number;
    totalCostVariance: number;
    averageCostVariancePercentage: number;
    varianceStatus: 'acceptable' | 'monitor' | 'action_required';
    itemCount: number;
    projectCount: number;
    vendorCount: number;
  }>;
  byVendor: Array<{
    vendorName: string;
    totalWorkAssigned: number;
    totalEstimatedCost: number;
    totalActualCost: number;
    totalProfitability: number;
    profitMargin: number;
    totalCostVariance: number;
    costVariancePercentage: number;
    varianceStatus: 'acceptable' | 'monitor' | 'action_required';
    itemCount: number;
    projectCount: number;
    categoryCount: number;
  }>;
  byVendorAndCategory: Array<{
    subCategory: string;
    vendorName: string;
    totalWorkAssigned: number;
    totalEstimatedCost: number;
    totalActualCost: number;
    totalSavingsDeficit: number;
    profitability: number;
    profitMargin: number;
    costVariance: number;
    costVariancePercentage: number;
    varianceStatus: 'acceptable' | 'monitor' | 'action_required';
    itemCount: number;
    projectCount: number;
  }>;
  view?: string;
}

interface VendorAnalyticsCardProps {
  vendorId?: string;
  view?: 'category' | 'vendor';
}

export default function VendorAnalyticsCard({ vendorId, view: initialView = 'category' }: VendorAnalyticsCardProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'category' | 'vendor'>(initialView);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let url = `/api/vendors/analytics?view=${view}`;
        if (vendorId) {
          url += `&vendorId=${vendorId}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }
        
        const result = await response.json();
        
        if (result.success) {
          setData(result.data);
        } else {
          throw new Error(result.error || 'Failed to fetch analytics');
        }
      } catch (err) {
        console.error('[VendorAnalyticsCard] Error fetching analytics:', err);
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [vendorId, view]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Vendor Analytics
          </CardTitle>
          <CardDescription>Profitability by category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading analytics...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Vendor Analytics
          </CardTitle>
          <CardDescription>Profitability by category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getVarianceStatusColor = (status: 'acceptable' | 'monitor' | 'action_required') => {
    if (status === 'acceptable') return 'text-green-600';
    if (status === 'monitor') return 'text-yellow-600';
    return 'text-red-600';
  };

  const getVarianceStatusBadge = (status: 'acceptable' | 'monitor' | 'action_required') => {
    if (status === 'acceptable') return <Badge variant="default" className="bg-green-600">Acceptable</Badge>;
    if (status === 'monitor') return <Badge variant="secondary" className="bg-yellow-600">Monitor</Badge>;
    return <Badge variant="destructive">Action Required</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Vendor Analytics
        </CardTitle>
        <CardDescription>
          {view === 'category' ? 'Profitability by category' : 'Profitability by vendor'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* View Toggle */}
        {!vendorId && (
          <Tabs value={view} onValueChange={(v) => setView(v as 'category' | 'vendor')}>
            <TabsList>
              <TabsTrigger value="category">By Category</TabsTrigger>
              <TabsTrigger value="vendor">By Vendor</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* Overall Summary */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Total Work Assigned</div>
            <div className="text-2xl font-bold">
              {formatCurrency(data.overall.totalWorkAssigned)}
            </div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Total Actual Cost</div>
            <div className="text-2xl font-bold">
              {formatCurrency(data.overall.totalActualCost)}
            </div>
          </div>
          <div className={`p-4 border rounded-lg ${data.overall.totalProfitability >= 0 ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'}`}>
            <div className="text-xs text-muted-foreground mb-1">Total Profitability</div>
            <div className={`text-2xl font-bold ${data.overall.totalProfitability >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.overall.totalProfitability)}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              {data.overall.totalProfitability >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {formatPercent(data.overall.averageProfitMargin)} margin
            </div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Cost Variance</div>
            <div className={`text-2xl font-bold ${getVarianceStatusColor(data.overall.averageCostVariancePercentage > 10 ? 'action_required' : data.overall.averageCostVariancePercentage > 5 ? 'monitor' : 'acceptable')}`}>
              {formatPercent(data.overall.averageCostVariancePercentage)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatCurrency(data.overall.totalCostVariance)}
            </div>
          </div>
        </div>

        {/* Category View */}
        {view === 'category' && data.byCategory.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3">Profitability by Category</h4>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Work Assigned</TableHead>
                    <TableHead className="text-right">Estimated Cost</TableHead>
                    <TableHead className="text-right">Actual Cost</TableHead>
                    <TableHead className="text-right">Profitability</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-right">Cost Variance</TableHead>
                    <TableHead className="text-right">Vendors</TableHead>
                    <TableHead className="text-right">Projects</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byCategory.map((category) => (
                    <TableRow key={category.category}>
                      <TableCell className="font-medium">{category.category}</TableCell>
                      <TableCell className="text-right">{formatCurrency(category.totalWorkAssigned)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(category.totalEstimatedCost)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(category.totalActualCost)}</TableCell>
                      <TableCell className={`text-right font-semibold ${category.totalProfitability >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(category.totalProfitability)}
                      </TableCell>
                      <TableCell className={`text-right ${category.averageProfitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercent(category.averageProfitMargin)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className={getVarianceStatusColor(category.varianceStatus)}>
                            {formatPercent(category.averageCostVariancePercentage)}
                          </span>
                          {getVarianceStatusBadge(category.varianceStatus)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{category.vendorCount}</TableCell>
                      <TableCell className="text-right">{category.projectCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Vendor View */}
        {view === 'vendor' && data.byVendor && data.byVendor.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3">Profitability by Vendor</h4>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Work Assigned</TableHead>
                    <TableHead className="text-right">Estimated Cost</TableHead>
                    <TableHead className="text-right">Actual Cost</TableHead>
                    <TableHead className="text-right">Profitability</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-right">Cost Variance</TableHead>
                    <TableHead className="text-right">Categories</TableHead>
                    <TableHead className="text-right">Projects</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byVendor.map((vendor) => (
                    <TableRow key={vendor.vendorName}>
                      <TableCell className="font-medium">{vendor.vendorName}</TableCell>
                      <TableCell className="text-right">{formatCurrency(vendor.totalWorkAssigned)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(vendor.totalEstimatedCost)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(vendor.totalActualCost)}</TableCell>
                      <TableCell className={`text-right font-semibold ${vendor.totalProfitability >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(vendor.totalProfitability)}
                      </TableCell>
                      <TableCell className={`text-right ${vendor.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercent(vendor.profitMargin)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className={getVarianceStatusColor(vendor.varianceStatus)}>
                            {formatPercent(vendor.costVariancePercentage)}
                          </span>
                          {getVarianceStatusBadge(vendor.varianceStatus)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{vendor.categoryCount}</TableCell>
                      <TableCell className="text-right">{vendor.projectCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {((view === 'category' && data.byCategory.length === 0) || (view === 'vendor' && (!data.byVendor || data.byVendor.length === 0))) && (
          <div className="text-center py-8 text-muted-foreground">
            No vendor data available. Assign vendors to order items to see analytics.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

