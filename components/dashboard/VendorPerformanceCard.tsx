'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Target, DollarSign, BarChart3 } from 'lucide-react';

interface Vendor {
  id: string;
  name: string;
  performanceMetrics?: {
    totalWorkAssigned: number;
    totalEstimatedCost: number;
    totalActualCost: number;
    totalProfitability: number;
    costVariance: number;
    costVariancePercentage: number;
    profitMargin: number;
    itemCount: number;
    projectCount: number;
    costAccuracyScore: number;
    profitabilityScore: number;
    reliabilityScore: number;
    overallPerformanceScore: number;
    riskLevel: 'low' | 'medium' | 'high';
  };
}

interface VendorPerformanceCardProps {
  vendor: Vendor;
}

export default function VendorPerformanceCard({ vendor }: VendorPerformanceCardProps) {
  if (!vendor.performanceMetrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Performance Scorecard
          </CardTitle>
          <CardDescription>Vendor performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No performance data available. Assign this vendor to order items to see metrics.
          </div>
        </CardContent>
      </Card>
    );
  }

  const metrics = vendor.performanceMetrics;

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

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (score: number): 'default' | 'secondary' | 'destructive' => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
  };

  const getVarianceStatus = (variancePercent: number) => {
    // Negative variance (over budget) = bad, positive variance (under budget) = good
    if (variancePercent < -10) {
      return { color: 'text-red-600', label: 'Action Required' };
    } else if (variancePercent < -5) {
      return { color: 'text-yellow-600', label: 'Monitor' };
    } else if (variancePercent > 20) {
      return { color: 'text-yellow-600', label: 'Monitor' }; // Large positive = estimation accuracy concern
    } else {
      return { color: 'text-green-600', label: 'Acceptable' };
    }
  };

  const varianceStatus = getVarianceStatus(metrics.costVariancePercentage);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Performance Scorecard
        </CardTitle>
        <CardDescription>Key performance indicators and scores</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Performance Score */}
        <div className="p-6 border rounded-lg bg-muted/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Overall Performance Score</span>
            </div>
            <Badge variant={getScoreBadgeVariant(metrics.overallPerformanceScore)} className="text-lg px-3 py-1">
              {metrics.overallPerformanceScore.toFixed(0)}/100
            </Badge>
          </div>
          <div className={`text-4xl font-bold ${getScoreColor(metrics.overallPerformanceScore)}`}>
            {metrics.overallPerformanceScore.toFixed(1)}
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Weighted composite: 40% Cost Accuracy, 40% Profitability, 20% Reliability
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Cost Accuracy</span>
              <Badge variant={getScoreBadgeVariant(metrics.costAccuracyScore)} className="text-xs">
                {metrics.costAccuracyScore.toFixed(0)}
              </Badge>
            </div>
            <div className={`text-2xl font-bold ${getScoreColor(metrics.costAccuracyScore)}`}>
              {metrics.costAccuracyScore.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Variance: {formatPercent(metrics.costVariancePercentage)}
            </div>
            <div className={`text-xs mt-1 ${varianceStatus.color}`}>
              {varianceStatus.label}
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Profitability</span>
              <Badge variant={getScoreBadgeVariant(metrics.profitabilityScore)} className="text-xs">
                {metrics.profitabilityScore.toFixed(0)}
              </Badge>
            </div>
            <div className={`text-2xl font-bold ${getScoreColor(metrics.profitabilityScore)}`}>
              {metrics.profitabilityScore.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Margin: {formatPercent(metrics.profitMargin)}
            </div>
            <div className={`text-xs mt-1 flex items-center gap-1 ${metrics.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {metrics.profitMargin >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {metrics.profitMargin >= 15 ? 'Excellent' : metrics.profitMargin >= 5 ? 'Good' : 'Needs Improvement'}
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Reliability</span>
              <Badge variant={getScoreBadgeVariant(metrics.reliabilityScore)} className="text-xs">
                {metrics.reliabilityScore.toFixed(0)}
              </Badge>
            </div>
            <div className={`text-2xl font-bold ${getScoreColor(metrics.reliabilityScore)}`}>
              {metrics.reliabilityScore.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Based on completion rate
            </div>
            <div className="text-xs text-muted-foreground mt-1 italic">
              (Placeholder - requires timeline data)
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Work Assigned</span>
            </div>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.totalWorkAssigned)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Across {metrics.projectCount} project{metrics.projectCount !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Profitability</span>
            </div>
            <div className={`text-2xl font-bold ${metrics.totalProfitability >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(metrics.totalProfitability)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatPercent(metrics.profitMargin)} margin
            </div>
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
              <div className={`text-lg font-semibold ${metrics.costVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(metrics.costVariance)}
              </div>
              <div className={`text-xs mt-1 ${varianceStatus.color}`}>
                {formatPercent(metrics.costVariancePercentage)} ({varianceStatus.label})
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

