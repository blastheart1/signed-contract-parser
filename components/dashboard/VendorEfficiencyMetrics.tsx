'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, Package, DollarSign, BarChart3, CheckCircle2, TrendingUp } from 'lucide-react';

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
  };
}

interface VendorEfficiencyMetricsProps {
  vendorId: string;
}

interface EfficiencyData {
  itemsPerProject: number;
  averageCostPerItem: number;
  averageProjectValue: number;
  costEfficiencyScore: number;
  categoryDistribution?: Array<{
    category: string;
    percentage: number;
    workAssigned: number;
  }>;
}

export default function VendorEfficiencyMetrics({ vendorId }: VendorEfficiencyMetricsProps) {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [vendorId]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch vendor data
      const vendorRes = await fetch(`/api/vendors/${vendorId}`);
      const vendorResult = await vendorRes.json();
      
      if (!vendorResult.success) {
        throw new Error(vendorResult.error || 'Failed to fetch vendor');
      }
      setVendor(vendorResult.data);

      // Fetch analytics data for category distribution
      const analyticsRes = await fetch(`/api/vendors/analytics?vendorId=${vendorId}&view=category`);
      const analyticsResult = await analyticsRes.json();
      
      if (analyticsResult.success) {
        setAnalyticsData(analyticsResult.data);
      }
    } catch (err) {
      console.error('[VendorEfficiencyMetrics] Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Efficiency Metrics
          </CardTitle>
          <CardDescription>Vendor efficiency and performance indicators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">Loading metrics...</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !vendor || !vendor.performanceMetrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Efficiency Metrics
          </CardTitle>
          <CardDescription>Vendor efficiency and performance indicators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-destructive">
            {error || 'No performance data available'}
          </div>
        </CardContent>
      </Card>
    );
  }

  const metrics = vendor.performanceMetrics;
  
  // Calculate efficiency metrics
  const itemsPerProject = metrics.projectCount > 0 
    ? metrics.itemCount / metrics.projectCount 
    : 0;
  
  const averageCostPerItem = metrics.itemCount > 0 
    ? metrics.totalActualCost / metrics.itemCount 
    : 0;
  
  const averageProjectValue = metrics.projectCount > 0 
    ? metrics.totalWorkAssigned / metrics.projectCount 
    : 0;

  // Cost efficiency score: combination of cost accuracy and profitability
  const costEfficiencyScore = (metrics.costAccuracyScore * 0.5) + (metrics.profitabilityScore * 0.5);

  // Calculate category distribution
  let categoryDistribution: Array<{ category: string; percentage: number; workAssigned: number }> = [];
  if (analyticsData?.byCategory) {
    const totalWork = analyticsData.overall?.totalWorkAssigned || metrics.totalWorkAssigned;
    categoryDistribution = analyticsData.byCategory
      .map((cat: any) => ({
        category: cat.category || 'Uncategorized',
        percentage: totalWork > 0 ? (cat.totalWorkAssigned / totalWork) * 100 : 0,
        workAssigned: cat.totalWorkAssigned,
      }))
      .sort((a: any, b: any) => b.workAssigned - a.workAssigned)
      .slice(0, 5); // Top 5 categories
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Efficiency Metrics
        </CardTitle>
        <CardDescription>Vendor efficiency and performance indicators</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Efficiency Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Items per Project</span>
            </div>
            <div className="text-2xl font-bold">
              {itemsPerProject.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {metrics.itemCount} items / {metrics.projectCount} projects
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Avg Cost per Item</span>
            </div>
            <div className="text-2xl font-bold">
              {formatCurrency(averageCostPerItem)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatCurrency(metrics.totalActualCost)} total
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Avg Project Value</span>
            </div>
            <div className="text-2xl font-bold">
              {formatCurrency(averageProjectValue)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatCurrency(metrics.totalWorkAssigned)} total
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Cost Efficiency</span>
            </div>
            <div className="flex items-center justify-between">
              <div className={`text-2xl font-bold ${getScoreColor(costEfficiencyScore)}`}>
                {costEfficiencyScore.toFixed(0)}
              </div>
              <Badge variant={getScoreBadgeVariant(costEfficiencyScore)} className="text-xs">
                {costEfficiencyScore >= 80 ? 'Excellent' : costEfficiencyScore >= 60 ? 'Good' : 'Needs Improvement'}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Based on accuracy & profitability
            </div>
          </div>
        </div>

        {/* Category Distribution */}
        {categoryDistribution.length > 0 && (
          <div className="p-4 border rounded-lg">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Work Distribution by Category
            </h4>
            <div className="space-y-3">
              {categoryDistribution.map((cat, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{cat.category}</span>
                    <span className="text-sm text-muted-foreground">{formatPercent(cat.percentage)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(cat.workAssigned)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Cost Accuracy Score</span>
            </div>
            <div className="flex items-center justify-between">
              <div className={`text-xl font-bold ${getScoreColor(metrics.costAccuracyScore)}`}>
                {metrics.costAccuracyScore.toFixed(0)}/100
              </div>
              <Badge variant={getScoreBadgeVariant(metrics.costAccuracyScore)} className="text-xs">
                {formatPercent(Math.abs(metrics.costVariancePercentage))} variance
              </Badge>
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Profitability Score</span>
            </div>
            <div className="flex items-center justify-between">
              <div className={`text-xl font-bold ${getScoreColor(metrics.profitabilityScore)}`}>
                {metrics.profitabilityScore.toFixed(0)}/100
              </div>
              <Badge variant={getScoreBadgeVariant(metrics.profitabilityScore)} className="text-xs">
                {formatPercent(metrics.profitMargin)} margin
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

