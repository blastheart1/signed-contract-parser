'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';

interface RevenueData {
  totalEarned: number;
  totalInvoiced: number;
  totalCollected: number;
  revenueGap: number;
  collectionEfficiency: number;
  billingEfficiency: number;
}

export default function RevenueRecognitionCard() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/dashboard/revenue');
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch revenue recognition');
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
          <CardTitle>Revenue Recognition</CardTitle>
          <CardDescription>Earned vs invoiced vs collected revenue</CardDescription>
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
          <CardTitle>Revenue Recognition</CardTitle>
          <CardDescription>Earned vs invoiced vs collected revenue</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-destructive">{error || 'Failed to load data'}</div>
        </CardContent>
      </Card>
    );
  }

  const earnedPercent = data.totalEarned > 0 ? 100 : 0;
  const invoicedPercent = data.totalEarned > 0 ? (data.totalInvoiced / data.totalEarned) * 100 : 0;
  const collectedPercent = data.totalEarned > 0 ? (data.totalCollected / data.totalEarned) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Revenue Recognition
        </CardTitle>
        <CardDescription>Earned vs invoiced vs collected revenue</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Total Earned</div>
            <div className="text-2xl font-bold">
              ${data.totalEarned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-muted-foreground mt-1">From completed work</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Total Invoiced</div>
            <div className="text-2xl font-bold">
              ${data.totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Billed to customers</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Total Collected</div>
            <div className="text-2xl font-bold text-green-600">
              ${data.totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Payments received</div>
          </div>
        </div>

        {/* Progress Visualization */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Revenue Flow</span>
            <span className="text-muted-foreground">{collectedPercent.toFixed(1)}% collected</span>
          </div>
          <div className="h-8 bg-muted rounded-full overflow-hidden relative">
            <div
              className="h-full bg-blue-600 absolute left-0"
              style={{ width: `${earnedPercent}%` }}
            />
            <div
              className="h-full bg-yellow-600 absolute left-0"
              style={{ width: `${invoicedPercent}%` }}
            />
            <div
              className="h-full bg-green-600 absolute left-0"
              style={{ width: `${collectedPercent}%` }}
            />
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-600 rounded" />
              <span>Earned</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-600 rounded" />
              <span>Invoiced</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-600 rounded" />
              <span>Collected</span>
            </div>
          </div>
        </div>

        {/* Efficiency Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Collection Efficiency</span>
              <Badge variant={data.collectionEfficiency >= 80 ? 'default' : 'secondary'}>
                {data.collectionEfficiency >= 80 ? (
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1" />
                )}
                {data.collectionEfficiency.toFixed(1)}%
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Collected / Invoiced
            </div>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Billing Efficiency</span>
              <Badge variant={data.billingEfficiency >= 90 ? 'default' : 'secondary'}>
                {data.billingEfficiency >= 90 ? (
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1" />
                )}
                {data.billingEfficiency.toFixed(1)}%
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Invoiced / Earned
            </div>
          </div>
        </div>

        {/* Revenue Gap */}
        {data.revenueGap !== 0 && (
          <div className={`p-4 rounded-lg ${data.revenueGap > 0 ? 'bg-yellow-50 dark:bg-yellow-950' : 'bg-green-50 dark:bg-green-950'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Revenue Gap</div>
                <div className="text-xs text-muted-foreground">
                  Earned - Invoiced - Collected
                </div>
              </div>
              <div className={`text-2xl font-bold ${data.revenueGap > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                {data.revenueGap > 0 ? '+' : ''}
                ${data.revenueGap.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

