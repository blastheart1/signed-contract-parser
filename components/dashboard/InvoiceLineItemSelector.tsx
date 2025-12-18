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
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AvailableItem {
  id: string;
  productService: string;
  mainCategory?: string | null; // Main category for visual purposes
  amount: number;
  thisBill: number;
  progressOverallPct: number;
  previouslyInvoicedPct: number;
  existingInvoiceAmounts: number;
  remainingBillable: number;
  isFullyCompletedAndInvoiced: boolean;
  canLink: boolean;
}

interface SelectedItem {
  itemId: string;
  amount: number;
}

interface InvoiceLineItemSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  selectedItemIds?: string[]; // Pre-selected items (for editing - backward compatibility)
  selectedItemsWithAmounts?: SelectedItem[]; // Pre-selected items with amounts (for editing)
  onSave: (selectedItems: SelectedItem[], totalAmount: number) => void;
}

export default function InvoiceLineItemSelector({
  open,
  onOpenChange,
  orderId,
  selectedItemIds = [],
  selectedItemsWithAmounts = [],
  onSave,
}: InvoiceLineItemSelectorProps) {
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(selectedItemIds));
  // Map of itemId -> user-entered invoice amount (can differ from thisBill)
  const [itemAmounts, setItemAmounts] = useState<Map<string, number>>(new Map());

  // Load available items when modal opens
  useEffect(() => {
    if (open && orderId) {
      fetchAvailableItems();
      // Reset selection to pre-selected items
      const idsToSelect = selectedItemsWithAmounts.length > 0 
        ? selectedItemsWithAmounts.map(item => item.itemId)
        : selectedItemIds;
      setSelectedIds(new Set(idsToSelect));
      
      // Initialize amounts from selectedItemsWithAmounts if provided
      if (selectedItemsWithAmounts.length > 0) {
        const newAmounts = new Map<string, number>();
        selectedItemsWithAmounts.forEach(item => {
          newAmounts.set(item.itemId, item.amount);
        });
        setItemAmounts(newAmounts);
      }
    }
  }, [open, orderId, selectedItemIds, selectedItemsWithAmounts]);

  // Initialize amounts when items are loaded and items are selected (fallback for backward compatibility)
  useEffect(() => {
    if (availableItems.length > 0 && selectedItemIds.length > 0 && selectedItemsWithAmounts.length === 0) {
      const newAmounts = new Map(itemAmounts);
      let hasChanges = false;
      availableItems.forEach(item => {
        if (selectedItemIds.includes(item.id) && !newAmounts.has(item.id)) {
          // Initialize with thisBill if not already set
          newAmounts.set(item.id, item.thisBill);
          hasChanges = true;
        }
      });
      if (hasChanges) {
        setItemAmounts(newAmounts);
      }
    }
  }, [availableItems, selectedItemIds, selectedItemsWithAmounts]);

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
    const item = availableItems.find(i => i.id === itemId);
    
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
      // Remove amount when unselected
      const newAmounts = new Map(itemAmounts);
      newAmounts.delete(itemId);
      setItemAmounts(newAmounts);
    } else {
      newSelected.add(itemId);
      // Initialize with thisBill value when selected
      if (item) {
        const newAmounts = new Map(itemAmounts);
        newAmounts.set(itemId, item.thisBill);
        setItemAmounts(newAmounts);
      }
    }
    setSelectedIds(newSelected);
  };

  const handleAmountChange = (itemId: string, value: string) => {
    const item = availableItems.find(i => i.id === itemId);
    if (!item) return;

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      // Allow empty input
      const newAmounts = new Map(itemAmounts);
      newAmounts.set(itemId, 0);
      setItemAmounts(newAmounts);
      return;
    }

    // Validate: cannot exceed remaining billable amount
    const maxAmount = item.remainingBillable;
    const clampedValue = Math.max(0, Math.min(numValue, maxAmount));
    
    const newAmounts = new Map(itemAmounts);
    newAmounts.set(itemId, clampedValue);
    setItemAmounts(newAmounts);

    // Show warning if user tried to exceed limit
    if (numValue > maxAmount) {
      // Validation feedback handled by UI (input max attribute)
    }
  };

  const handleSave = () => {
    // Build selected items array with user-entered amounts (include items with 0 amount)
    const selectedItems: SelectedItem[] = Array.from(selectedIds)
      .map(itemId => {
        const amount = itemAmounts.get(itemId) || 0;
        return { itemId, amount }; // Include even if amount is 0
      })
      .filter(item => item.amount >= 0); // Include items with 0 amount

    if (selectedItems.length === 0) {
      setError('Please select at least one item');
      return;
    }

    // Calculate total from user-entered amounts
    const total = selectedItems.reduce((sum, item) => sum + item.amount, 0);
    onSave(selectedItems, total);
    onOpenChange(false);
  };

  const formatCurrency = (value: number): string => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (value: number): string => {
    return `${value.toFixed(2)}%`;
  };

  // Calculate running total of selected items' user-entered amounts
  const selectedTotal = Array.from(selectedIds).reduce((sum, itemId) => {
    const amount = itemAmounts.get(itemId) || 0;
    return sum + amount;
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Link Line Items to Invoice</DialogTitle>
          <DialogDescription>
            Select line items to link to this invoice. Enter the invoice amount for each item (auto-populated from THIS BILL). The total invoice amount will be calculated from the sum of entered amounts.
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
            <p>No items available.</p>
            <p className="text-sm mt-2">Items must have Progress Overall % &gt; 0 and remaining billable amount.</p>
          </div>
        ) : (
          <>
            <div className="overflow-y-auto flex-1 pr-2 -mr-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Select</TableHead>
                    <TableHead>Main Category</TableHead>
                    <TableHead>Product/Service</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Invoice Amount</TableHead>
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
                        <TableCell className="min-w-[150px] max-w-[200px] break-words align-top text-muted-foreground">
                          {item.mainCategory || '—'}
                        </TableCell>
                        <TableCell className="min-w-[200px] max-w-[300px] break-words align-top">
                          {item.productService}
                        </TableCell>
                        <TableCell className="text-right align-top">{formatCurrency(item.amount)}</TableCell>
                        <TableCell className="align-top">
                          {isSelected ? (
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max={item.remainingBillable}
                                value={itemAmounts.get(item.id) ?? item.thisBill}
                                onChange={(e) => handleAmountChange(item.id, e.target.value)}
                                className="w-full h-8 text-right pl-6 pr-2 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-appearance]:textfield"
                                placeholder="0.00"
                              />
                              {itemAmounts.get(item.id) !== undefined && itemAmounts.get(item.id)! > item.remainingBillable && (
                                <p className="text-xs text-destructive mt-1">Max: {formatCurrency(item.remainingBillable)}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground align-top">
                          {formatCurrency(item.thisBill)}
                        </TableCell>
                        <TableCell className="text-right align-top">{formatPercent(item.progressOverallPct)}</TableCell>
                        <TableCell className="text-right align-top">{formatPercent(item.previouslyInvoicedPct)}</TableCell>
                        <TableCell className="text-right text-muted-foreground align-top">
                          {formatCurrency(item.existingInvoiceAmounts)}
                        </TableCell>
                        <TableCell className="text-right font-medium align-top">
                          <span className={item.remainingBillable <= 0 ? 'text-destructive' : ''}>
                          {formatCurrency(item.remainingBillable)}
                          </span>
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
          <Button 
            onClick={handleSave} 
            disabled={selectedIds.size === 0 || loading || selectedTotal <= 0}
          >
            Save Selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
