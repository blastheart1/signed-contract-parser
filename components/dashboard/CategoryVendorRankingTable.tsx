'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import SortableTableHeaderArrowOnly from '@/components/dashboard/SortableTableHeaderArrowOnly';
import { sortData, type SortState, type SortDirection } from '@/lib/utils/tableSorting';

interface Vendor {
  vendorName: string;
  rank: number;
  totalWorkAssigned: number;
  totalEstimatedCost: number;
  totalActualCost: number;
  totalProfitability: number;
  profitMargin: number;
  costVariance: number;
  costVariancePercentage: number;
  varianceStatus: 'acceptable' | 'monitor' | 'action_required';
  projectCount: number;
  itemCount: number;
  performanceScore: number;
  trend: 'improving' | 'declining' | 'stable';
  isTopPerformer: boolean;
  isMostEfficient: boolean;
  needsImprovement: boolean;
}

interface CategoryVendorRankingTableProps {
  vendors: Vendor[];
}

export default function CategoryVendorRankingTable({ vendors }: CategoryVendorRankingTableProps) {
  const [sortState, setSortState] = useState<SortState<Vendor>>({ column: null, direction: null });
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
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

  const getTrendIcon = (trend: 'improving' | 'declining' | 'stable') => {
    if (trend === 'improving') return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend === 'declining') return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const handleSortChange = (column: keyof Vendor, direction: SortDirection) => {
    setSortState({ column, direction });
  };

  const processedVendors = useMemo(() => {
    return sortData(vendors, sortState, (item, column) => {
      switch (column) {
        case 'vendorName':
          return item.vendorName;
        case 'rank':
          return item.rank;
        case 'totalWorkAssigned':
          return item.totalWorkAssigned;
        case 'totalProfitability':
          return item.totalProfitability;
        case 'profitMargin':
          return item.profitMargin;
        case 'costVariancePercentage':
          return item.costVariancePercentage;
        case 'projectCount':
          return item.projectCount;
        case 'performanceScore':
          return item.performanceScore;
        default:
          return item[column];
      }
    });
  }, [vendors, sortState]);

  if (vendors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Vendor Performance Ranking
          </CardTitle>
          <CardDescription>Ranked vendors by performance in this category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No vendors found for this category
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Vendor Performance Ranking
        </CardTitle>
        <CardDescription>Ranked vendors by performance score in this category</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px] text-center">Rank</TableHead>
                <SortableTableHeaderArrowOnly
                  column="vendorName"
                  title="Vendor"
                  currentSort={sortState}
                  onSortChange={handleSortChange}
                  className="border-l-2 border-border"
                />
                <SortableTableHeaderArrowOnly
                  column="totalProfitability"
                  title="Profitability"
                  currentSort={sortState}
                  onSortChange={handleSortChange}
                  className="text-right"
                />
                <SortableTableHeaderArrowOnly
                  column="profitMargin"
                  title="Margin"
                  currentSort={sortState}
                  onSortChange={handleSortChange}
                  className="text-right"
                />
                <SortableTableHeaderArrowOnly
                  column="costVariancePercentage"
                  title="Cost Variance"
                  currentSort={sortState}
                  onSortChange={handleSortChange}
                  className="text-right"
                />
                <SortableTableHeaderArrowOnly
                  column="totalWorkAssigned"
                  title="Work Assigned"
                  currentSort={sortState}
                  onSortChange={handleSortChange}
                  className="text-right"
                />
                <SortableTableHeaderArrowOnly
                  column="projectCount"
                  title="Projects"
                  currentSort={sortState}
                  onSortChange={handleSortChange}
                  className="text-right"
                />
                <SortableTableHeaderArrowOnly
                  column="performanceScore"
                  title="Performance Score"
                  currentSort={sortState}
                  onSortChange={handleSortChange}
                  className="text-right"
                />
                <TableHead className="w-[80px] text-center">Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedVendors.map((vendor) => {
                const vendorId = vendorNameToIdMap.get(vendor.vendorName);
                
                return (
                  <TableRow 
                    key={vendor.vendorName} 
                    className="hover:bg-green-200 dark:hover:bg-green-800/40 hover:shadow-sm transition-colors duration-150"
                  >
                    <TableCell className="text-center">
                      <span className="font-semibold">{vendor.rank}</span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {vendorId ? (
                        <Link 
                          href={`/dashboard/vendors/${vendorId}`}
                          className="hover:underline cursor-pointer"
                        >
                          {vendor.vendorName}
                        </Link>
                      ) : (
                        vendor.vendorName
                      )}
                    </TableCell>
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
                    <TableCell className="text-right">{formatCurrency(vendor.totalWorkAssigned)}</TableCell>
                    <TableCell className="text-right">{vendor.projectCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="font-semibold">{vendor.performanceScore.toFixed(0)}</span>
                        <span className="text-xs text-muted-foreground">/100</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {getTrendIcon(vendor.trend)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

