'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, RefreshCw, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface InvoiceSummaryProps {
  orderId: string;
  customerId?: string; // dbxCustomerId for updating invoicing status
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

export default function InvoiceSummary({ orderId, customerId, refreshTrigger }: InvoiceSummaryProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoicingStatus, setInvoicingStatus] = useState<'pending_updates' | 'completed' | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const { toast } = useToast();

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

  // Fetch customer invoicing status
  const fetchCustomerStatus = useCallback(async () => {
    if (!customerId) return;
    try {
      const response = await fetch(`/api/customers/${customerId}`);
      const data = await response.json();
      if (data.success && data.customer) {
        setInvoicingStatus(data.customer.status || 'pending_updates');
      }
    } catch (err) {
      console.error('Error fetching customer status:', err);
    }
  }, [customerId]);

  // Handle status update
  const handleStatusChange = useCallback(async (checked: boolean) => {
    if (!customerId) return;
    setUpdatingStatus(true);
    const newStatus = checked ? 'completed' : 'pending_updates';
    
    try {
      const response = await fetch(`/api/customers/${customerId}/invoicing-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (data.success) {
        setInvoicingStatus(newStatus);
        toast({
          title: 'Status updated',
          description: `Invoicing status updated to "${checked ? 'Okay for Invoicing' : 'Waiting for PM'}"`,
        });
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to update status',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update invoicing status',
        variant: 'destructive',
      });
    } finally {
      setUpdatingStatus(false);
    }
  }, [customerId, toast]);

  useEffect(() => {
    setLoading(true);
    fetchSummary();
    fetchCustomerStatus();
  }, [fetchSummary, fetchCustomerStatus, refreshTrigger]); // Refresh when orderId or refreshTrigger changes

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
    <Card className="h-full max-h-[336px] flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CardTitle>Invoice Summary</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Calculated values matching Template-V2.xlsx (M345:N349)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={loading}
                  className="p-1 hover:bg-muted rounded-md transition-colors duration-150"
                  aria-label="Refresh invoice summary"
                >
                  <RefreshCw className={`h-4 w-4 text-muted-foreground hover:text-foreground ${loading ? 'animate-spin' : ''}`} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <div className="space-y-1.5 pb-2">
          {customerId && invoicingStatus !== null && (
            <div className="flex justify-between items-center py-1">
              <span className="text-sm font-medium text-muted-foreground">For Invoicing:</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Switch
                        checked={invoicingStatus === 'completed'}
                        onCheckedChange={handleStatusChange}
                        disabled={updatingStatus}
                        aria-label="Set Invoicing Status"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Set Invoicing Status</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
          <div className="flex justify-between items-center py-1">
            <span className="text-sm font-medium text-muted-foreground">Original Invoice (Balance Due):</span>
            <span className="text-sm font-semibold">{formatCurrency(summary.originalInvoice)}</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-sm font-medium text-muted-foreground">Balance Remaining</span>
            <span className="text-sm font-semibold">{formatCurrency(summary.balanceRemaining)}</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-sm font-medium text-muted-foreground">Total % Completed:</span>
            <div className="text-right">
              <span className="text-sm font-semibold">{summary.percentCompleted.toFixed(2)}%</span>
              <span className="text-xs text-muted-foreground ml-2">({formatCurrency(summary.totalCompleted)})</span>
            </div>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-sm font-medium text-muted-foreground">Less Payments Received:</span>
            <span className="text-sm font-semibold">{formatCurrency(summary.lessPaymentsReceived)}</span>
          </div>
          <div className="flex justify-between items-center py-1 pt-2">
            <span className="text-base font-bold">Total Due Upon Receipt:</span>
            <span className="text-base font-bold">{formatCurrency(summary.totalDueUponReceipt)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

