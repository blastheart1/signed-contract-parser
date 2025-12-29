'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Package, Building2 } from 'lucide-react';

interface CategoryMetrics {
  totalWorkAssigned: number;
  totalEstimatedCost: number;
  totalActualCost: number;
  totalProfitability: number;
  profitMargin: number;
  costVariance: number;
  costVariancePercentage: number;
  itemCount: number;
  projectCount: number;
  vendorCount: number;
  averageProjectValue: number;
  averageProfitabilityPerProject: number;
  averageCostPerItem: number;
  costPerProject: number;
  costPerDollarWorkAssigned: number;
  profitableProjectsCount: number;
  unprofitableProjectsCount: number;
  profitableProjectsPercentage: number;
  unprofitableProjectsPercentage: number;
}

interface CategoryInfoProps {
  category: string;
  metrics: CategoryMetrics;
}

export default function CategoryInfo({ category, metrics }: CategoryInfoProps) {
  const formatCurrency = (value: number | undefined | null) => {
    const numValue = value ?? 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numValue);
  };

  const formatPercent = (value: number | undefined | null) => {
    const numValue = value ?? 0;
    return `${numValue >= 0 ? '+' : ''}${numValue.toFixed(2)}%`;
  };

  const getVarianceStatusColor = (variancePercent: number | undefined | null) => {
    const numValue = variancePercent ?? 0;
    if (numValue < -10) return 'text-red-600';
    if (numValue < -5) return 'text-yellow-600';
    if (numValue > 20) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getVarianceStatusBadge = (variancePercent: number | undefined | null) => {
    const numValue = variancePercent ?? 0;
    if (numValue < -10) {
      return <Badge variant="destructive" className="w-[120px] flex items-center justify-center">Action Required</Badge>;
    }
    if (numValue < -5) {
      return <Badge variant="secondary" className="bg-yellow-600 w-[120px] flex items-center justify-center">Monitor</Badge>;
    }
    if (numValue > 20) {
      return <Badge variant="secondary" className="bg-yellow-600 w-[120px] flex items-center justify-center">Monitor</Badge>;
    }
    return <Badge variant="default" className="bg-green-600 w-[120px] flex items-center justify-center">Acceptable</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          {category}
        </CardTitle>
        <CardDescription>Category performance overview</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Work Assigned</span>
            </div>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.totalWorkAssigned)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Across {metrics.projectCount ?? 0} project{(metrics.projectCount ?? 0) !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Profitability</span>
            </div>
            <div className={`text-2xl font-bold ${(metrics.totalProfitability ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(metrics.totalProfitability)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatPercent(metrics.profitMargin)} margin
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Cost Variance</span>
            </div>
            <div className={`text-2xl font-bold ${getVarianceStatusColor(metrics.costVariancePercentage)}`}>
              {formatPercent(metrics.costVariancePercentage)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatCurrency(metrics.costVariance)}
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Items</span>
            </div>
            <div className="text-2xl font-bold">
              {(metrics.itemCount ?? 0).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {metrics.vendorCount ?? 0} vendor{(metrics.vendorCount ?? 0) !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Efficiency Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Average Project Value</div>
            <div className="text-lg font-semibold">{formatCurrency(metrics.averageProjectValue)}</div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Avg Profitability per Project</div>
            <div className={`text-lg font-semibold ${(metrics.averageProfitabilityPerProject ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(metrics.averageProfitabilityPerProject)}
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Average Cost per Item</div>
            <div className="text-lg font-semibold">{formatCurrency(metrics.averageCostPerItem)}</div>
          </div>
        </div>

        {/* Cost Variance Details */}
        <div className="p-4 border rounded-lg">
          <h4 className="text-sm font-semibold mb-3">Cost Variance Analysis</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Estimated Cost</div>
              <div className="text-lg font-semibold">{formatCurrency(metrics.totalEstimatedCost)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Actual Cost</div>
              <div className="text-lg font-semibold">{formatCurrency(metrics.totalActualCost)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Variance</div>
              <div className={`text-lg font-semibold ${getVarianceStatusColor(metrics.costVariancePercentage)}`}>
                {formatPercent(metrics.costVariancePercentage)}
              </div>
              <div className="mt-1">
                {getVarianceStatusBadge(metrics.costVariancePercentage)}
              </div>
            </div>
          </div>
        </div>

        {/* Project Profitability Distribution */}
        <div className="p-4 border rounded-lg">
          <h4 className="text-sm font-semibold mb-3">Project Profitability</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Profitable Projects</div>
              <div className="text-lg font-semibold text-green-600">
                {metrics.profitableProjectsCount ?? 0} ({(metrics.profitableProjectsPercentage ?? 0).toFixed(0)}%)
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Unprofitable Projects</div>
              <div className="text-lg font-semibold text-red-600">
                {metrics.unprofitableProjectsCount ?? 0} ({(metrics.unprofitableProjectsPercentage ?? 0).toFixed(0)}%)
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Total Projects</div>
              <div className="text-lg font-semibold">{metrics.projectCount ?? 0}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

