'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TrendDataPoint {
  period: string;
  profitability: number;
  totalWorkAssigned: number;
  totalEstimatedCost: number;
  totalActualCost: number;
  projectCount: number;
  itemCount: number;
  profitMargin: number;
  costVariance: number;
  costVariancePercentage: number;
}

interface TrendsData {
  period: 'monthly' | 'quarterly';
  trends: TrendDataPoint[];
}

interface VendorTrendAnalysisProps {
  vendorId: string;
}

export default function VendorTrendAnalysis({ vendorId }: VendorTrendAnalysisProps) {
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'monthly' | 'quarterly'>('monthly');

  useEffect(() => {
    fetchTrends();
  }, [vendorId, period]);

  const fetchTrends = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/vendors/${vendorId}/trends?period=${period}`);
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch trends');
      }
    } catch (err) {
      console.error('[VendorTrendAnalysis] Error fetching trends:', err);
      setError(err instanceof Error ? err.message : 'Failed to load trends');
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
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const formatPeriod = (period: string) => {
    if (period.includes('Q')) {
      return period; // Already formatted as "2024-Q1"
    }
    // Format "2024-01" to "Jan 2024"
    const [year, month] = period.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const calculateTrend = (values: number[]) => {
    if (values.length < 2) return { direction: 'neutral', change: 0, changePercent: 0 };
    const first = values[0];
    const last = values[values.length - 1];
    const change = last - first;
    const changePercent = first !== 0 ? (change / Math.abs(first)) * 100 : 0;
    return {
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
      change,
      changePercent,
    };
  };

  const renderSimpleChart = (values: number[], labels: string[], color: string, formatValue: (v: number) => string) => {
    if (values.length === 0) return null;

    const maxValue = Math.max(...values.map(Math.abs));
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;

    return (
      <div className="relative h-48 w-full">
        <svg viewBox="0 0 400 150" className="w-full h-full">
          <defs>
            <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.05" />
            </linearGradient>
          </defs>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((y, i) => (
            <line
              key={i}
              x1="40"
              y1={20 + y * 110}
              x2="380"
              y2={20 + y * 110}
              stroke="#e5e7eb"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
          ))}
          {/* Area under curve */}
          <path
            d={`M 40 ${130 - ((values[0] - minValue) / range) * 110} ${values.map((v, i) => `L ${40 + (i * 340) / (values.length - 1)} ${130 - ((v - minValue) / range) * 110}`).join(' ')} L ${40 + (340)} 130 L 40 130 Z`}
            fill={`url(#gradient-${color})`}
          />
          {/* Line */}
          <polyline
            points={values.map((v, i) => `${40 + (i * 340) / (values.length - 1 || 1)},${130 - ((v - minValue) / range) * 110}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Data points */}
          {values.map((v, i) => (
            <circle
              key={i}
              cx={40 + (i * 340) / (values.length - 1 || 1)}
              cy={130 - ((v - minValue) / range) * 110}
              r="4"
              fill={color}
              stroke="white"
              strokeWidth="2"
            />
          ))}
        </svg>
        {/* X-axis labels */}
        <div className="flex justify-between mt-2 text-xs text-muted-foreground px-2">
          {labels.map((label, i) => (
            <span key={i} className="transform -rotate-45 origin-left" style={{ width: `${100 / labels.length}%` }}>
              {label}
            </span>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Trend Analysis
          </CardTitle>
          <CardDescription>Historical performance trends</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">Loading trends...</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Trend Analysis
          </CardTitle>
          <CardDescription>Historical performance trends</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-destructive">{error || 'Failed to load trends'}</div>
        </CardContent>
      </Card>
    );
  }

  if (data.trends.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Trend Analysis
          </CardTitle>
          <CardDescription>Historical performance trends</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No trend data available. Assign this vendor to order items to see trends.
          </div>
        </CardContent>
      </Card>
    );
  }

  const profitabilityTrend = calculateTrend(data.trends.map(t => t.profitability));
  const costTrend = calculateTrend(data.trends.map(t => t.totalActualCost));
  const volumeTrend = calculateTrend(data.trends.map(t => t.totalWorkAssigned));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Trend Analysis
            </CardTitle>
            <CardDescription>Historical performance trends over time</CardDescription>
          </div>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as 'monthly' | 'quarterly')}>
            <TabsList>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Profitability Trends */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Profitability Trends</h3>
            </div>
            <div className="flex items-center gap-2">
              {profitabilityTrend.direction === 'up' ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : profitabilityTrend.direction === 'down' ? (
                <TrendingDown className="h-4 w-4 text-red-600" />
              ) : null}
              <span className={`text-sm font-medium ${profitabilityTrend.direction === 'up' ? 'text-green-600' : profitabilityTrend.direction === 'down' ? 'text-red-600' : 'text-muted-foreground'}`}>
                {formatPercent(profitabilityTrend.changePercent)}
              </span>
            </div>
          </div>
          {renderSimpleChart(
            data.trends.map(t => t.profitability),
            data.trends.map(t => formatPeriod(t.period)),
            '#10b981',
            formatCurrency
          )}
          <div className="mt-2 text-xs text-muted-foreground">
            Current: {formatCurrency(data.trends[data.trends.length - 1]?.profitability || 0)}
          </div>
        </div>

        {/* Cost Trends */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Cost Trends</h3>
            </div>
            <div className="flex items-center gap-2">
              {costTrend.direction === 'up' ? (
                <TrendingUp className="h-4 w-4 text-red-600" />
              ) : costTrend.direction === 'down' ? (
                <TrendingDown className="h-4 w-4 text-green-600" />
              ) : null}
              <span className={`text-sm font-medium ${costTrend.direction === 'up' ? 'text-red-600' : costTrend.direction === 'down' ? 'text-green-600' : 'text-muted-foreground'}`}>
                {formatPercent(costTrend.changePercent)}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {renderSimpleChart(
              data.trends.map(t => t.totalEstimatedCost),
              data.trends.map(t => formatPeriod(t.period)),
              '#3b82f6',
              formatCurrency
            )}
            {renderSimpleChart(
              data.trends.map(t => t.totalActualCost),
              data.trends.map(t => formatPeriod(t.period)),
              '#ef4444',
              formatCurrency
            )}
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-500"></div>
              <span className="text-muted-foreground">Estimated</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500"></div>
              <span className="text-muted-foreground">Actual</span>
            </div>
          </div>
        </div>

        {/* Volume Trends */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Volume Trends</h3>
            </div>
            <div className="flex items-center gap-2">
              {volumeTrend.direction === 'up' ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : volumeTrend.direction === 'down' ? (
                <TrendingDown className="h-4 w-4 text-red-600" />
              ) : null}
              <span className={`text-sm font-medium ${volumeTrend.direction === 'up' ? 'text-green-600' : volumeTrend.direction === 'down' ? 'text-red-600' : 'text-muted-foreground'}`}>
                {formatPercent(volumeTrend.changePercent)}
              </span>
            </div>
          </div>
          {renderSimpleChart(
            data.trends.map(t => t.totalWorkAssigned),
            data.trends.map(t => formatPeriod(t.period)),
            '#8b5cf6',
            formatCurrency
          )}
          <div className="mt-2 grid grid-cols-3 gap-4 text-xs">
            <div>
              <div className="text-muted-foreground">Work Assigned</div>
              <div className="font-semibold">{formatCurrency(data.trends[data.trends.length - 1]?.totalWorkAssigned || 0)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Projects</div>
              <div className="font-semibold">{data.trends[data.trends.length - 1]?.projectCount || 0}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Items</div>
              <div className="font-semibold">{data.trends[data.trends.length - 1]?.itemCount || 0}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

