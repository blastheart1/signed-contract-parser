'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface InvoiceSummaryProps {
  orderId: string;
  refreshTrigger?: number; // Increment this to force refresh
}

interface Summary {
  originalInvoice: number;
  balanceRemaining: number;
  totalCompleted: number;
  percentCompleted: number; // Percentage completed
  lessPaymentsReceived: number;
  totalDueUponReceipt: number;
}

export default function InvoiceSummary({ orderId, refreshTrigger }: InvoiceSummaryProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/orders/${orderId}/invoice-summary`);
      const data = await response.json();

      if (data.success) {
        setSummary(data.summary);
      } else {
        setError(data.error || 'Failed to fetch invoice summary');
      }
    } catch (err) {
      console.error('Error fetching invoice summary:', err);
      setError('Failed to fetch invoice summary');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const handleRefresh = () => {
    fetchSummary();
  };

  useEffect(() => {
    setLoading(true);
    fetchSummary();
  }, [fetchSummary, refreshTrigger]); // Refresh when orderId or refreshTrigger changes

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return null;
  }

  const formatCurrency = (value: number): string => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Invoice Summary</CardTitle>
            <CardDescription>Calculated values matching Template-V2.xlsx (M345:N349)</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium text-muted-foreground">Original Invoice:</span>
            <span className="text-sm font-semibold">{formatCurrency(summary.originalInvoice)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium text-muted-foreground">Balance Remaining</span>
            <span className="text-sm font-semibold">{formatCurrency(summary.balanceRemaining)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium text-muted-foreground">Total % Completed:</span>
            <div className="text-right">
              <span className="text-sm font-semibold">{summary.percentCompleted.toFixed(2)}%</span>
              <span className="text-xs text-muted-foreground ml-2">({formatCurrency(summary.totalCompleted)})</span>
            </div>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium text-muted-foreground">Less Payments Received:</span>
            <span className="text-sm font-semibold">{formatCurrency(summary.lessPaymentsReceived)}</span>
          </div>
          <div className="flex justify-between items-center py-2 pt-3 border-t-2">
            <span className="text-base font-bold">Total Due Upon Receipt:</span>
            <span className="text-base font-bold">{formatCurrency(summary.totalDueUponReceipt)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

