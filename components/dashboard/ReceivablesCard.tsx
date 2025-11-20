'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, DollarSign, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface ReceivablesData {
  totalOutstanding: number;
  agingBuckets: {
    '0-30': number;
    '31-60': number;
    '61-90': number;
    '90+': number;
  };
  topCustomers: Array<{
    customerId: string;
    clientName: string;
    total: number;
  }>;
  collectionRate: number;
  totalInvoiced: number;
  totalCollected: number;
  receivablesCount: number;
}

export default function ReceivablesCard() {
  const [data, setData] = useState<ReceivablesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/dashboard/receivables');
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch receivables');
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
          <CardTitle>Outstanding Receivables</CardTitle>
          <CardDescription>Money owed and aging analysis</CardDescription>
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
          <CardTitle>Outstanding Receivables</CardTitle>
          <CardDescription>Money owed and aging analysis</CardDescription>
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
              <DollarSign className="h-5 w-5" />
              Outstanding Receivables
            </CardTitle>
            <CardDescription>Money owed and aging analysis</CardDescription>
          </div>
          <Badge variant={data.totalOutstanding > 0 ? 'destructive' : 'secondary'}>
            {data.receivablesCount} Accounts
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Outstanding */}
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">
              ${data.totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-sm text-muted-foreground">Total Outstanding</span>
          </div>
        </div>

        {/* Aging Buckets */}
        <div>
          <h4 className="text-sm font-semibold mb-3">Aging Analysis</h4>
          <div className="grid grid-cols-4 gap-2">
            <div className="p-3 border rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">0-30 Days</div>
              <div className="text-lg font-semibold text-green-600">
                ${data.agingBuckets['0-30'].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">31-60 Days</div>
              <div className="text-lg font-semibold text-yellow-600">
                ${data.agingBuckets['31-60'].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">61-90 Days</div>
              <div className="text-lg font-semibold text-orange-600">
                ${data.agingBuckets['61-90'].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">90+ Days</div>
              <div className="text-lg font-semibold text-red-600">
                ${data.agingBuckets['90+'].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        {/* Collection Rate */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div>
            <div className="text-sm text-muted-foreground">Collection Rate</div>
            <div className="text-2xl font-bold">{data.collectionRate.toFixed(1)}%</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Collected / Invoiced</div>
            <div className="text-sm">
              ${data.totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${data.totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Top Customers */}
        {data.topCustomers.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3">Top 10 Customers by Outstanding Amount</h4>
            <div className="space-y-2">
              {data.topCustomers.map((customer, index) => (
                <div
                  key={customer.customerId}
                  className="flex items-center justify-between p-2 border rounded hover:bg-accent"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-6">{index + 1}.</span>
                    <Link
                      href={`/dashboard/customers/${customer.customerId}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {customer.clientName}
                    </Link>
                  </div>
                  <span className="text-sm font-semibold">
                    ${customer.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

