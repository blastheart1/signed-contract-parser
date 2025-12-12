'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AvailableItem {
  id: string;
  productService: string;
  amount: number;
  thisBill: number;
  progressOverallPct: number;
  previouslyInvoicedPct: number;
  existingInvoiceAmounts: number;
  remainingBillable: number;
  isFullyCompletedAndInvoiced: boolean;
  canLink: boolean;
}

interface InvoiceLineItemSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  selectedItemIds?: string[]; // Pre-selected items (for editing)
  onSave: (selectedItemIds: string[], totalAmount: number) => void;
}

export default function InvoiceLineItemSelector({
  open,
  onOpenChange,
  orderId,
  selectedItemIds = [],
  onSave,
}: InvoiceLineItemSelectorProps) {
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(selectedItemIds));

  // Load available items when modal opens
  useEffect(() => {
    if (open && orderId) {
      fetchAvailableItems();
      // Reset selection to pre-selected items
      setSelectedIds(new Set(selectedItemIds));
    }
  }, [open, orderId, selectedItemIds]);

  const fetchAvailableItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/orders/${orderId}/items?availableForInvoice=true`);
      const data = await response.json();

      if (data.success) {
        setAvailableItems(data.items || []);
      } else {
        setError(data.error || 'Failed to fetch available items');
      }
    } catch (err) {
      console.error('Error fetching available items:', err);
      setError('Failed to fetch available items');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleItem = (itemId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedIds(newSelected);
  };

  const handleSave = () => {
    // Calculate total from selected items
    const selectedItems = availableItems.filter(item => selectedIds.has(item.id));
    const total = selectedItems.reduce((sum, item) => sum + (item.thisBill || 0), 0);
    onSave(Array.from(selectedIds), total);
    onOpenChange(false);
  };

  const formatCurrency = (value: number): string => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (value: number): string => {
    return `${value.toFixed(2)}%`;
  };

  // Calculate running total of selected items' THIS BILL values
  const selectedTotal = Array.from(selectedIds).reduce((sum, itemId) => {
    const item = availableItems.find(i => i.id === itemId);
    return sum + (item?.thisBill || 0);
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Link Line Items to Invoice</DialogTitle>
          <DialogDescription>
            Select line items to link to this invoice. The invoice amount will be calculated from the sum of selected items' THIS BILL values.
          </DialogDescription>
        </DialogHeader>

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
        ) : availableItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No billable items available.</p>
            <p className="text-sm mt-2">Items must have THIS BILL &gt; 0 and not be fully completed and invoiced.</p>
          </div>
        ) : (
          <>
            <div className="overflow-y-auto flex-1 pr-2 -mr-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Select</TableHead>
                    <TableHead>Product/Service</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">THIS BILL</TableHead>
                    <TableHead className="text-right">Progress %</TableHead>
                    <TableHead className="text-right">Prev. Invoiced %</TableHead>
                    <TableHead className="text-right">Existing Invoices</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableItems.map((item, index) => {
                    const isSelected = selectedIds.has(item.id);
                    const isEvenRow = index % 2 === 0;
                    return (
                      <TableRow 
                        key={item.id}
                        className={isEvenRow ? 'bg-muted/50 dark:bg-muted/30' : 'bg-background'}
                      >
                        <TableCell className="align-top">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleItem(item.id)}
                          />
                        </TableCell>
                        <TableCell className="min-w-[200px] max-w-[300px] break-words align-top">
                          {item.productService}
                        </TableCell>
                        <TableCell className="text-right align-top">{formatCurrency(item.amount)}</TableCell>
                        <TableCell className="text-right font-medium align-top">
                          {formatCurrency(item.thisBill)}
                        </TableCell>
                        <TableCell className="text-right align-top">{formatPercent(item.progressOverallPct)}</TableCell>
                        <TableCell className="text-right align-top">{formatPercent(item.previouslyInvoicedPct)}</TableCell>
                        <TableCell className="text-right text-muted-foreground align-top">
                          {formatCurrency(item.existingInvoiceAmounts)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground align-top">
                          {formatCurrency(item.remainingBillable)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium">Selected Items: {selectedIds.size}</span>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Total Invoice Amount:</div>
                  <div className="text-lg font-bold">{formatCurrency(selectedTotal)}</div>
                </div>
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={selectedIds.size === 0 || loading}>
            Save Selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
