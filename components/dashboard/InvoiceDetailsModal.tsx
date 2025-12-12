'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface LinkedLineItem {
  orderItemId: string;
  thisBillAmount: number;
  productService: string;
  amount: number;
  qty: number | null;
  rate: number | null;
  progressOverallPct: number | null;
  previouslyInvoicedPct: number | null;
  currentThisBill: number | null;
}

interface InvoiceDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  invoiceId: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  invoiceAmount: string | null;
}

export default function InvoiceDetailsModal({
  open,
  onOpenChange,
  orderId,
  invoiceId,
  invoiceNumber,
  invoiceDate,
  invoiceAmount,
}: InvoiceDetailsModalProps) {
  const [linkedItems, setLinkedItems] = useState<LinkedLineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalBilledAmount, setTotalBilledAmount] = useState(0);

  useEffect(() => {
    if (open && orderId && invoiceId) {
      fetchLinkedItems();
    }
  }, [open, orderId, invoiceId]);

  const fetchLinkedItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/orders/${orderId}/invoices/${invoiceId}/line-items`);
      const data = await response.json();

      if (data.success) {
        setLinkedItems(data.linkedItems || []);
        setTotalBilledAmount(data.totalBilledAmount || 0);
      } else {
        setError(data.error || 'Failed to fetch linked items');
      }
    } catch (err) {
      console.error('Error fetching linked items:', err);
      setError('Failed to fetch linked items');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number): string => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (value: number | null): string => {
    if (value === null) return '—';
    return `${value.toFixed(2)}%`;
  };

  const formatDate = (date: string | null): string => {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleDateString();
    } catch {
      return date;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Invoice Details</DialogTitle>
          <DialogDescription>
            View linked line items and billing information for this invoice
          </DialogDescription>
        </DialogHeader>

        {/* Invoice Info */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg mb-4">
          <div>
            <div className="text-sm text-muted-foreground">Invoice Number</div>
            <div className="font-medium">{invoiceNumber || '—'}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Invoice Date</div>
            <div className="font-medium">{formatDate(invoiceDate)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Invoice Amount</div>
            <div className="font-medium">
              {invoiceAmount ? formatCurrency(parseFloat(invoiceAmount)) : '—'}
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : linkedItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No line items linked to this invoice.</p>
          </div>
        ) : (
          <>
            <div className="overflow-y-auto flex-1 pr-2 -mr-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product/Service</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Progress %</TableHead>
                    <TableHead className="text-right">Prev. Invoiced %</TableHead>
                    <TableHead className="text-right">Billed (THIS BILL)</TableHead>
                    <TableHead className="text-right">Current THIS BILL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedItems.map((item, index) => {
                    const thisBillChanged = item.currentThisBill !== null && 
                      Math.abs(item.currentThisBill - item.thisBillAmount) > 0.01;
                    const isEvenRow = index % 2 === 0;
                    
                    return (
                      <TableRow 
                        key={item.orderItemId}
                        className={isEvenRow ? 'bg-muted/50 dark:bg-muted/30' : 'bg-background'}
                      >
                        <TableCell className="min-w-[200px] max-w-[300px] break-words align-top">
                          {item.productService}
                        </TableCell>
                        <TableCell className="text-right align-top">
                          {item.qty !== null ? item.qty.toLocaleString() : '—'}
                        </TableCell>
                        <TableCell className="text-right align-top">
                          {item.rate !== null ? formatCurrency(item.rate) : '—'}
                        </TableCell>
                        <TableCell className="text-right align-top">{formatCurrency(item.amount)}</TableCell>
                        <TableCell className="text-right align-top">{formatPercent(item.progressOverallPct)}</TableCell>
                        <TableCell className="text-right align-top">{formatPercent(item.previouslyInvoicedPct)}</TableCell>
                        <TableCell className="text-right font-medium align-top">
                          {formatCurrency(item.thisBillAmount)}
                          {thisBillChanged && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Historical
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground align-top">
                          {item.currentThisBill !== null ? formatCurrency(item.currentThisBill) : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {linkedItems.length} linked item{linkedItems.length !== 1 ? 's' : ''}
                </span>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Total Billed Amount:</div>
                  <div className="text-lg font-bold">{formatCurrency(totalBilledAmount)}</div>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
