'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Edit2, Save, X, Plus, Trash2, Loader2, Copy, Link2, Eye, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import InvoiceLineItemSelector from './InvoiceLineItemSelector';
import InvoiceDetailsModal from './InvoiceDetailsModal';

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  invoiceAmount: string | null;
  paymentsReceived: string;
  exclude: boolean;
  rowIndex: number | null;
  linkedLineItems?: Array<{ orderItemId: string; thisBillAmount: number }> | null;
}

interface InvoiceTableProps {
  orderId: string;
  onInvoiceChange?: () => void; // Callback to notify parent when invoices change
  isDeleted?: boolean; // Whether the contract is deleted
}

export default function InvoiceTable({ orderId, onInvoiceChange, isDeleted = false }: InvoiceTableProps) {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Partial<Invoice>>({});
  const [selectedLineItemIds, setSelectedLineItemIds] = useState<string[]>([]);
  const [linkedItemsTotal, setLinkedItemsTotal] = useState<number>(0); // Sum of linked items' THIS BILL values
  const [lineItemSelectorOpen, setLineItemSelectorOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedInvoiceForDetails, setSelectedInvoiceForDetails] = useState<Invoice | null>(null);

  // Fetch invoices
  useEffect(() => {
    fetchInvoices();
  }, [orderId]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/orders/${orderId}/invoices`);
      const data = await response.json();

      if (data.success) {
        setInvoices(data.invoices || []);
      } else {
        setError(data.error || 'Failed to fetch invoices');
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError('Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleAddInvoice = () => {
    // Prevent adding a new invoice if there's already an unsaved new invoice
    const hasUnsavedNewInvoice = invoices.some(inv => inv.id.startsWith('new-'));
    if (hasUnsavedNewInvoice) {
      toast({
        title: 'Please save or cancel',
        description: 'There is already an unsaved invoice. Please save or cancel it before adding a new one.',
        variant: 'destructive',
      });
      return;
    }

    // Also check if we're currently editing any invoice
    if (editingId !== null) {
      toast({
        title: 'Please save or cancel',
        description: 'Please save or cancel the current invoice before adding a new one.',
        variant: 'destructive',
      });
      return;
    }

    const newInvoice: Partial<Invoice> = {
      id: `new-${Date.now()}`,
      invoiceNumber: '',
      invoiceDate: '',
      invoiceAmount: '',
      paymentsReceived: '',
      exclude: false,
    };
    setInvoices([...invoices, newInvoice as Invoice]);
    setEditingId(newInvoice.id!);
    setEditingInvoice(newInvoice);
    setSelectedLineItemIds([]);
    setLinkedItemsTotal(0);
  };

  const handleEdit = (invoice: Invoice) => {
    setEditingId(invoice.id);
    setEditingInvoice({ ...invoice });
    // Load existing linked line item IDs if any
    if (invoice.linkedLineItems && Array.isArray(invoice.linkedLineItems)) {
      const linkedIds = invoice.linkedLineItems.map(item => item.orderItemId);
      setSelectedLineItemIds(linkedIds);
      // Calculate total from linked items' thisBillAmount values
      const total = invoice.linkedLineItems.reduce((sum, item) => {
        const amount = parseFloat(String(item.thisBillAmount || 0));
        return sum + amount;
      }, 0);
      setLinkedItemsTotal(total);
      // Auto-populate invoice amount with the total
      setEditingInvoice({ ...invoice, invoiceAmount: total > 0 ? total.toString() : invoice.invoiceAmount });
    } else {
      setSelectedLineItemIds([]);
      setLinkedItemsTotal(0);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingInvoice({});
    setSelectedLineItemIds([]);
    setLinkedItemsTotal(0);
    // If it was a new invoice, remove it from the list
    setInvoices(invoices.filter(inv => inv.id !== editingId || !inv.id.startsWith('new-')));
  };

  const handleSave = async (invoiceId: string) => {
    try {
      setSaving(invoiceId);
      setError(null);

      const invoiceData = editingInvoice;
      const isNew = invoiceId.startsWith('new-');

      const url = isNew
        ? `/api/orders/${orderId}/invoices`
        : `/api/orders/${orderId}/invoices/${invoiceId}`;

      const method = isNew ? 'POST' : 'PATCH';

      // Prepare request body
      const requestBody: any = {
        invoiceNumber: invoiceData.invoiceNumber || null,
        invoiceDate: invoiceData.invoiceDate || null,
        paymentsReceived: invoiceData.paymentsReceived || '0',
        exclude: invoiceData.exclude || false,
      };

      // Handle invoiceAmount - ensure it's null not empty string
      if (selectedLineItemIds.length > 0 && linkedItemsTotal > 0) {
        requestBody.invoiceAmount = linkedItemsTotal.toString();
      } else {
        requestBody.invoiceAmount = invoiceData.invoiceAmount && invoiceData.invoiceAmount.trim() !== '' 
          ? invoiceData.invoiceAmount 
          : null;
      }

      // Handle linkedLineItemIds
      // For PATCH: send empty array to clear, or array with IDs to set
      // For POST: only include if there are items to link
      if (isNew) {
        // POST: only include if there are items
        if (selectedLineItemIds.length > 0) {
          requestBody.linkedLineItemIds = selectedLineItemIds;
        }
      } else {
        // PATCH: always include to allow clearing (empty array) or setting (array with IDs)
        requestBody.linkedLineItemIds = selectedLineItemIds;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle non-200 responses
        const errorMessage = data.error || data.message || `Failed to save invoice (${response.status})`;
        const validationErrors = data.validationErrors || [];
        const fullErrorMessage = validationErrors.length > 0
          ? `${errorMessage}\n${validationErrors.map((err: any) => `- ${err.reason || err}`).join('\n')}`
          : errorMessage;
        
        setError(fullErrorMessage);
        toast({
          title: 'Failed to save invoice',
          description: fullErrorMessage,
          variant: 'destructive',
        });
        return;
      }

      if (data.success) {
        await fetchInvoices(); // Refresh list
        setEditingId(null);
        setEditingInvoice({});
        setSelectedLineItemIds([]);
        setLinkedItemsTotal(0);
        // Show success toast
        toast({
          title: isNew ? 'Invoice created' : 'Invoice updated',
          description: isNew ? 'New invoice has been added.' : 'Invoice has been updated.',
        });
        // Notify parent to refresh invoice summary
        if (onInvoiceChange) {
          onInvoiceChange();
        }
      } else {
        const errorMessage = data.error || 'Failed to save invoice';
        setError(errorMessage);
        toast({
          title: 'Failed to save invoice',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Error saving invoice:', err);
      const errorMessage = 'Failed to save invoice. Please check your connection and try again.';
      setError(errorMessage);
      toast({
        title: 'Error saving invoice',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) {
      return;
    }

    try {
      setSaving(invoiceId);
      setError(null);

      const response = await fetch(`/api/orders/${orderId}/invoices/${invoiceId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        await fetchInvoices(); // Refresh list
        // Show success toast
        toast({
          title: 'Invoice deleted',
          description: 'Invoice has been removed.',
        });
        // Notify parent to refresh invoice summary
        if (onInvoiceChange) {
          onInvoiceChange();
        }
      } else {
        const errorMessage = data.error || 'Failed to delete invoice';
        setError(errorMessage);
        toast({
          title: 'Failed to delete invoice',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Error deleting invoice:', err);
      const errorMessage = 'Failed to delete invoice. Please try again.';
      setError(errorMessage);
      toast({
        title: 'Error deleting invoice',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const calculateStatus = (invoice: Partial<Invoice>): 'Paid' | 'Open' | null => {
    const payments = parseFloat(invoice.paymentsReceived?.toString() || '0');
    const amount = parseFloat(invoice.invoiceAmount?.toString() || '0');

    if (payments > 0) return 'Paid';
    if (amount > 0) return 'Open';
    return null;
  };

  const calculateOpenBalance = (invoice: Partial<Invoice>): number => {
    const amount = parseFloat(invoice.invoiceAmount?.toString() || '0');
    const payments = parseFloat(invoice.paymentsReceived?.toString() || '0');
    return amount - payments;
  };

  // Calculate totals for Amount, Payments, and Open Balance
  // Exclude invoices marked with exclude: true from totals
  const totalAmount = useMemo(() => {
    return invoices
      .filter(invoice => !invoice.exclude)
      .reduce((sum, invoice) => {
        const amount = parseFloat(invoice.invoiceAmount?.toString() || '0');
        return sum + amount;
      }, 0);
  }, [invoices]);

  const totalPayments = useMemo(() => {
    return invoices
      .filter(invoice => !invoice.exclude)
      .reduce((sum, invoice) => {
        const payments = parseFloat(invoice.paymentsReceived?.toString() || '0');
        return sum + payments;
      }, 0);
  }, [invoices]);

  const totalOpenBalance = useMemo(() => {
    return invoices
      .filter(invoice => !invoice.exclude)
      .reduce((sum, invoice) => {
        const amount = parseFloat(invoice.invoiceAmount?.toString() || '0');
        const payments = parseFloat(invoice.paymentsReceived?.toString() || '0');
        return sum + (amount - payments);
      }, 0);
  }, [invoices]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-3/4 mx-auto animate-pulse" />
              <div className="h-4 bg-muted rounded w-1/2 mx-auto animate-pulse" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Invoices</CardTitle>
            <CardDescription>Manage invoices for this order (Rows 354-391)</CardDescription>
          </div>
          {isDeleted ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button onClick={() => {}} size="sm" disabled className="opacity-50 cursor-not-allowed">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Invoice
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Restore first before editing</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button 
                      onClick={handleAddInvoice} 
                      size="sm"
                      disabled={editingId !== null || invoices.some(inv => inv.id.startsWith('new-'))}
                      className={editingId !== null || invoices.some(inv => inv.id.startsWith('new-')) ? 'opacity-50 cursor-not-allowed' : ''}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Invoice
                    </Button>
                  </div>
                </TooltipTrigger>
                {(editingId !== null || invoices.some(inv => inv.id.startsWith('new-'))) && (
                  <TooltipContent>
                    <p>Please save or cancel the current invoice before adding a new one</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="rounded-md border overflow-x-auto">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px] border-r border-black">Status</TableHead>
                <TableHead className="w-[80px] border-r border-black">Exclude</TableHead>
                <TableHead className="w-[150px] border-r border-black">Invoice No.</TableHead>
                <TableHead className="w-[120px] border-r border-black">Date</TableHead>
                <TableHead className="w-[130px] text-right border-r border-black">Amount</TableHead>
                <TableHead className="w-[130px] text-right border-r border-black">Payments</TableHead>
                <TableHead className="w-[130px] text-right border-r border-black">Open Balance</TableHead>
                <TableHead className="w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="p-0">
                    <div
                      onClick={isDeleted ? undefined : handleAddInvoice}
                      className={`text-center text-muted-foreground py-8 transition-colors ${
                        isDeleted 
                          ? 'cursor-not-allowed opacity-50' 
                          : 'cursor-pointer hover:bg-green-200 dark:hover:bg-green-800/40 hover:text-foreground'
                      }`}
                    >
                      No invoices yet. Click "Add Invoice" to create one.
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((invoice) => {
                  const isEditing = editingId === invoice.id;
                  const isSaving = saving === invoice.id;
                  const displayInvoice = isEditing ? editingInvoice : invoice;
                  const status = calculateStatus(displayInvoice);
                  const openBalance = calculateOpenBalance(displayInvoice);

                  return (
                    <TableRow key={invoice.id} className="hover:bg-green-200 dark:hover:bg-green-800/40 hover:shadow-sm">
                      <TableCell className="w-[100px] min-h-[32px]">
                        <div className="min-h-[32px] flex items-center">
                          {status ? (
                            <Badge 
                              variant="outline" 
                              className={`w-[50px] flex items-center justify-center ${
                                status === 'Paid' 
                                  ? 'bg-green-500 text-white border-green-600 hover:bg-green-600' 
                                  : 'bg-orange-500 text-white border-orange-600 hover:bg-orange-600'
                              }`}
                            >
                              {status}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="w-[80px] min-h-[32px]">
                        {isEditing ? (
                          <Checkbox
                            checked={displayInvoice.exclude || false}
                            onCheckedChange={(checked) =>
                              setEditingInvoice({ ...editingInvoice, exclude: checked === true })
                            }
                          />
                        ) : (
                          <div className="min-h-[32px] flex items-center">
                            {displayInvoice.exclude ? 'Yes' : 'No'}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="w-[150px] min-h-[32px]">
                        {isEditing ? (
                          <Input
                            value={displayInvoice.invoiceNumber || ''}
                            onChange={(e) =>
                              setEditingInvoice({ ...editingInvoice, invoiceNumber: e.target.value })
                            }
                            placeholder="Invoice No."
                            className="w-full h-8"
                          />
                        ) : (
                          <div className="min-h-[32px] flex items-center">
                            {invoice.linkedLineItems && invoice.linkedLineItems.length > 0 ? (
                              <button
                                onClick={() => {
                                  setSelectedInvoiceForDetails(invoice);
                                  setDetailsModalOpen(true);
                                }}
                                className="text-left hover:underline cursor-pointer"
                                title="Click to view linked items"
                              >
                                {displayInvoice.invoiceNumber || <span className="text-muted-foreground/30">—</span>}
                              </button>
                            ) : (
                              displayInvoice.invoiceNumber || <span className="text-muted-foreground/30">—</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="w-[120px] min-h-[32px]">
                        {isEditing ? (
                          <Input
                            type="date"
                            value={displayInvoice.invoiceDate ? new Date(displayInvoice.invoiceDate).toISOString().split('T')[0] : ''}
                            onChange={(e) =>
                              setEditingInvoice({ ...editingInvoice, invoiceDate: e.target.value })
                            }
                            className="w-full h-8"
                          />
                        ) : (
                          <div className="min-h-[32px] flex items-center">
                            {displayInvoice.invoiceDate
                              ? new Date(displayInvoice.invoiceDate).toLocaleDateString()
                              : <span className="text-muted-foreground/30">—</span>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="w-[130px] text-right min-h-[32px]">
                        {isEditing ? (
                          <div className="relative w-full">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={displayInvoice.invoiceAmount || ''}
                              onChange={(e) => {
                                const newValue = e.target.value;
                                // If items are linked, prevent exceeding the linked items total
                                if (selectedLineItemIds.length > 0 && linkedItemsTotal > 0) {
                                  const numValue = parseFloat(newValue);
                                  if (!isNaN(numValue) && numValue > linkedItemsTotal) {
                                    // Don't allow exceeding the total - set to max
                                    setEditingInvoice({ ...editingInvoice, invoiceAmount: linkedItemsTotal.toString() });
                                    toast({
                                      title: 'Amount limit',
                                      description: `Invoice amount cannot exceed the linked items total of $${linkedItemsTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                                      variant: 'destructive',
                                    });
                                    return;
                                  }
                                }
                                setEditingInvoice({ ...editingInvoice, invoiceAmount: newValue });
                              }}
                              placeholder="0.00"
                              className="w-full h-8 text-right pl-7 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-appearance]:textfield"
                              readOnly={selectedLineItemIds.length > 0}
                              max={selectedLineItemIds.length > 0 ? linkedItemsTotal : undefined}
                              title={selectedLineItemIds.length > 0 
                                ? `Amount calculated from ${selectedLineItemIds.length} linked item(s). Total: $${linkedItemsTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : ''}
                            />
                          </div>
                        ) : (
                          <div className="min-h-[32px] flex items-center justify-end">
                            {displayInvoice.invoiceAmount
                              ? `$${parseFloat(displayInvoice.invoiceAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : <span className="text-muted-foreground/30">—</span>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="w-[130px] text-right min-h-[32px]">
                        {isEditing ? (
                          <div className="relative w-full">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10">$</span>
                            {(!displayInvoice.paymentsReceived || displayInvoice.paymentsReceived === '0' || displayInvoice.paymentsReceived === '') && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const amount = displayInvoice.invoiceAmount || '0';
                                        setEditingInvoice({ ...editingInvoice, paymentsReceived: amount });
                                      }}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                      }}
                                      className="absolute left-8 top-1/2 -translate-y-1/2 h-7 w-7 p-0 pointer-events-auto z-20"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Same Amount</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            <Input
                              type="number"
                              step="0.01"
                              value={displayInvoice.paymentsReceived || ''}
                              onChange={(e) =>
                                setEditingInvoice({ ...editingInvoice, paymentsReceived: e.target.value })
                              }
                              placeholder="0.00"
                              className={`w-full h-8 text-right pr-3 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-appearance]:textfield ${
                                (!displayInvoice.paymentsReceived || displayInvoice.paymentsReceived === '0' || displayInvoice.paymentsReceived === '') 
                                  ? 'pl-16' 
                                  : 'pl-7'
                              }`}
                            />
                          </div>
                        ) : (
                          <div className="min-h-[32px] flex items-center justify-end">
                            {`$${parseFloat(displayInvoice.paymentsReceived || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="w-[130px] text-right font-medium min-h-[32px]">
                        <div className="min-h-[32px] flex items-center justify-end">
                          ${openBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </TableCell>
                      <TableCell className="w-[140px] min-h-[32px]">
                        {isEditing ? (
                          <div className="flex gap-2 items-center">
                            {selectedLineItemIds.length > 0 && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center">
                                      <Info className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{selectedLineItemIds.length} item{selectedLineItemIds.length !== 1 ? 's' : ''} linked (${linkedItemsTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setLineItemSelectorOpen(true)}
                                    disabled={isSaving}
                                  >
                                    <Link2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Link Line Items</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSave(invoice.id)}
                              disabled={isSaving}
                            >
                              {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancel}
                              disabled={isSaving}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      if (invoice.linkedLineItems && invoice.linkedLineItems.length > 0) {
                                        setSelectedInvoiceForDetails(invoice);
                                        setDetailsModalOpen(true);
                                      }
                                    }}
                                    disabled={!invoice.linkedLineItems || invoice.linkedLineItems.length === 0}
                                    className={(!invoice.linkedLineItems || invoice.linkedLineItems.length === 0) ? 'opacity-50 cursor-not-allowed' : ''}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    {invoice.linkedLineItems && invoice.linkedLineItems.length > 0 
                                      ? 'View Linked Items' 
                                      : 'No linked items'}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            {isDeleted ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {}}
                                        disabled
                                        className="opacity-50 cursor-not-allowed"
                                      >
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Restore first before editing</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(invoice)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            )}
                            {isDeleted ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {}}
                                        disabled
                                        className="opacity-50 cursor-not-allowed"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Restore first before editing</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(invoice.id)}
                                disabled={isSaving}
                              >
                                {isSaving ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
              {/* Total row */}
              {invoices.length > 0 && (
                <TableRow className="bg-muted/50 dark:bg-muted/30 border-t-2 border-primary/20">
                  <TableCell className="font-bold text-right">
                    Total:
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right font-bold border-r border-black"></TableCell>
                  <TableCell className="text-right font-bold border-r border-black">
                    ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-bold border-r border-black">
                    ${totalPayments.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-bold border-r border-black">
                    ${totalOpenBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Line Item Selector Modal */}
      <InvoiceLineItemSelector
        open={lineItemSelectorOpen}
        onOpenChange={setLineItemSelectorOpen}
        orderId={orderId}
        selectedItemIds={selectedLineItemIds}
        onSave={(itemIds, totalAmount) => {
          setSelectedLineItemIds(itemIds);
          setLinkedItemsTotal(totalAmount);
          // Auto-populate invoice amount with the total
          if (itemIds.length > 0 && totalAmount > 0) {
            setEditingInvoice({ ...editingInvoice, invoiceAmount: totalAmount.toString() });
          } else {
            // Clear invoice amount if no items linked
            setEditingInvoice({ ...editingInvoice, invoiceAmount: '' });
          }
        }}
      />

      {/* Invoice Details Modal */}
      {selectedInvoiceForDetails && (
        <InvoiceDetailsModal
          open={detailsModalOpen}
          onOpenChange={setDetailsModalOpen}
          orderId={orderId}
          invoiceId={selectedInvoiceForDetails.id}
          invoiceNumber={selectedInvoiceForDetails.invoiceNumber}
          invoiceDate={selectedInvoiceForDetails.invoiceDate}
          invoiceAmount={selectedInvoiceForDetails.invoiceAmount}
        />
      )}
    </Card>
  );
}

