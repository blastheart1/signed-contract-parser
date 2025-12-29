'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SortableTableHeaderArrowOnly from '@/components/dashboard/SortableTableHeaderArrowOnly';
import FilterableTableHeader from '@/components/dashboard/FilterableTableHeader';
import { sortData, type SortState } from '@/lib/utils/tableSorting';

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
  
  // Sorting state for category view
  const [categorySortState, setCategorySortState] = useState<SortState<AnalyticsData['byCategory'][0]>>({
    column: null,
    direction: null,
  });
  
  // Sorting state for vendor view
  const [vendorSortState, setVendorSortState] = useState<SortState<AnalyticsData['byVendor'][0]>>({
    column: null,
    direction: null,
  });
  
  // Filtering state for category
  const [categoryFilter, setCategoryFilter] = useState<Set<string | null>>(new Set());
  
  // Vendor name to ID mapping for clickable vendor names
  const [vendorNameToIdMap, setVendorNameToIdMap] = useState<Map<string, string>>(new Map());

  // Fetch vendors to create name-to-ID mapping
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const res = await fetch('/api/vendors?pageSize=1000&includeDeleted=false');
        const data = await res.json();
        if (data.success) {
          const map = new Map<string, string>();
          data.data.forEach((v: { id: string; name: string }) => {
            map.set(v.name, v.id);
          });
          setVendorNameToIdMap(map);
        }
      } catch (err) {
        console.error('Failed to fetch vendors for mapping:', err);
      }
    };
    fetchVendors();
  }, []);

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

  // Get unique categories for filter - must be before early returns
  const uniqueCategories = useMemo(() => {
    if (!data) return [];
    const cats = new Set<string>();
    data.byCategory.forEach(cat => {
      if (cat.category) {
        cats.add(cat.category);
      }
    });
    return Array.from(cats).sort().map(cat => ({ value: cat, label: cat }));
  }, [data]);

  // Sort and filter category data - must be before early returns
  const processedCategoryData = useMemo(() => {
    if (!data || !data.byCategory) return [];
    
    let filtered = data.byCategory;
    
    // Apply category filter
    if (categoryFilter.size > 0) {
      filtered = filtered.filter(cat => categoryFilter.has(cat.category));
    }
    
    // Apply sorting
    return sortData(filtered, categorySortState, (item, column) => {
      switch (column) {
        case 'category':
          return item.category;
        case 'totalWorkAssigned':
          return item.totalWorkAssigned;
        case 'totalEstimatedCost':
          return item.totalEstimatedCost;
        case 'totalActualCost':
          return item.totalActualCost;
        case 'totalProfitability':
          return item.totalProfitability;
        case 'averageProfitMargin':
          return item.averageProfitMargin;
        case 'averageCostVariancePercentage':
          return item.averageCostVariancePercentage;
        default:
          return item[column];
      }
    });
  }, [data, categorySortState, categoryFilter]);

  // Sort vendor data - must be before early returns
  const processedVendorData = useMemo(() => {
    if (!data || !data.byVendor) return [];
    
    return sortData(data.byVendor, vendorSortState, (item, column) => {
      switch (column) {
        case 'vendorName':
          return item.vendorName;
        case 'totalWorkAssigned':
          return item.totalWorkAssigned;
        case 'totalEstimatedCost':
          return item.totalEstimatedCost;
        case 'totalActualCost':
          return item.totalActualCost;
        case 'totalProfitability':
          return item.totalProfitability;
        case 'profitMargin':
          return item.profitMargin;
        case 'costVariancePercentage':
          return item.costVariancePercentage;
        default:
          return item[column];
      }
    });
  }, [data, vendorSortState]);

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
    if (status === 'acceptable') return <Badge variant="default" className="bg-green-600 w-[120px] flex items-center justify-center">Acceptable</Badge>;
    if (status === 'monitor') return <Badge variant="secondary" className="bg-yellow-600 w-[120px] flex items-center justify-center">Monitor</Badge>;
    return <Badge variant="destructive" className="w-[120px] flex items-center justify-center">Action Required</Badge>;
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
            <div className={`text-2xl font-bold ${getVarianceStatusColor(
              data.overall.averageCostVariancePercentage < -10 
                ? 'action_required' 
                : data.overall.averageCostVariancePercentage < -5 || data.overall.averageCostVariancePercentage > 20
                ? 'monitor' 
                : 'acceptable'
            )}`}>
              {formatPercent(data.overall.averageCostVariancePercentage)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatCurrency(data.overall.totalCostVariance)}
            </div>
          </div>
        </div>

        {/* Category View */}
        {view === 'category' && processedCategoryData.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3">Profitability by Category</h4>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <FilterableTableHeader
                      title="Category"
                      options={uniqueCategories}
                      selectedValues={categoryFilter}
                      onFilterChange={setCategoryFilter}
                    />
                    <SortableTableHeaderArrowOnly
                      column="totalWorkAssigned"
                      title="Work Assigned"
                      currentSort={categorySortState}
                      onSortChange={(col, dir) => setCategorySortState({ column: col, direction: dir })}
                      className="text-right"
                    />
                    <SortableTableHeaderArrowOnly
                      column="totalEstimatedCost"
                      title="Estimated Cost"
                      currentSort={categorySortState}
                      onSortChange={(col, dir) => setCategorySortState({ column: col, direction: dir })}
                      className="text-right"
                    />
                    <SortableTableHeaderArrowOnly
                      column="totalActualCost"
                      title="Actual Cost"
                      currentSort={categorySortState}
                      onSortChange={(col, dir) => setCategorySortState({ column: col, direction: dir })}
                      className="text-right"
                    />
                    <SortableTableHeaderArrowOnly
                      column="totalProfitability"
                      title="Profitability"
                      currentSort={categorySortState}
                      onSortChange={(col, dir) => setCategorySortState({ column: col, direction: dir })}
                      className="text-right"
                    />
                    <SortableTableHeaderArrowOnly
                      column="averageProfitMargin"
                      title="Margin"
                      currentSort={categorySortState}
                      onSortChange={(col, dir) => setCategorySortState({ column: col, direction: dir })}
                      className="text-right"
                    />
                    <SortableTableHeaderArrowOnly
                      column="averageCostVariancePercentage"
                      title="Cost Variance"
                      currentSort={categorySortState}
                      onSortChange={(col, dir) => setCategorySortState({ column: col, direction: dir })}
                      className="text-right"
                    />
                    <TableHead className="text-right border-l-2 border-border">Vendors</TableHead>
                    <TableHead className="text-right">Projects</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedCategoryData.map((category) => (
                    <TableRow key={category.category} className="hover:bg-green-200 dark:hover:bg-green-800/40 hover:shadow-sm transition-colors duration-150">
                      <TableCell className="font-medium">
                        {category.category ? (
                          <Link 
                            href={`/dashboard/categories/${encodeURIComponent(category.category)}`}
                            className="hover:underline cursor-pointer"
                          >
                            {category.category}
                          </Link>
                        ) : (
                          category.category
                        )}
                      </TableCell>
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
        {view === 'vendor' && processedVendorData.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3">Profitability by Vendor</h4>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <SortableTableHeaderArrowOnly
                      column="totalWorkAssigned"
                      title="Work Assigned"
                      currentSort={vendorSortState}
                      onSortChange={(col, dir) => setVendorSortState({ column: col, direction: dir })}
                      className="text-right border-l-2 border-border"
                    />
                    <SortableTableHeaderArrowOnly
                      column="totalEstimatedCost"
                      title="Estimated Cost"
                      currentSort={vendorSortState}
                      onSortChange={(col, dir) => setVendorSortState({ column: col, direction: dir })}
                      className="text-right"
                    />
                    <SortableTableHeaderArrowOnly
                      column="totalActualCost"
                      title="Actual Cost"
                      currentSort={vendorSortState}
                      onSortChange={(col, dir) => setVendorSortState({ column: col, direction: dir })}
                      className="text-right"
                    />
                    <SortableTableHeaderArrowOnly
                      column="totalProfitability"
                      title="Profitability"
                      currentSort={vendorSortState}
                      onSortChange={(col, dir) => setVendorSortState({ column: col, direction: dir })}
                      className="text-right"
                    />
                    <SortableTableHeaderArrowOnly
                      column="profitMargin"
                      title="Margin"
                      currentSort={vendorSortState}
                      onSortChange={(col, dir) => setVendorSortState({ column: col, direction: dir })}
                      className="text-right"
                    />
                    <SortableTableHeaderArrowOnly
                      column="costVariancePercentage"
                      title="Cost Variance"
                      currentSort={vendorSortState}
                      onSortChange={(col, dir) => setVendorSortState({ column: col, direction: dir })}
                      className="text-right"
                    />
                    <TableHead className="text-right border-l-2 border-border">Categories</TableHead>
                    <TableHead className="text-right">Projects</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedVendorData.map((vendor) => {
                    const vendorId = vendorNameToIdMap.get(vendor.vendorName);
                    return (
                    <TableRow key={vendor.vendorName} className="hover:bg-green-200 dark:hover:bg-green-800/40 hover:shadow-sm transition-colors duration-150">
                      <TableCell className="font-medium">
                        {vendorId ? (
                          <Link href={`/dashboard/vendors/${vendorId}`} className="hover:underline cursor-pointer">
                            {vendor.vendorName}
                          </Link>
                        ) : (
                          <span>{vendor.vendorName}</span>
                        )}
                      </TableCell>
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
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {((view === 'category' && processedCategoryData.length === 0) || (view === 'vendor' && processedVendorData.length === 0)) && (
          <div className="text-center py-8 text-muted-foreground">
            {categoryFilter.size > 0 || (view === 'category' && data?.byCategory.length === 0) || (view === 'vendor' && (!data?.byVendor || data.byVendor.length === 0))
              ? 'No vendor data available. Assign vendors to order items to see analytics.'
              : 'No data matches the current filters.'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

