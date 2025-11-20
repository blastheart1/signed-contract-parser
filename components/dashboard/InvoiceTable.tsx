'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Edit2, Save, X, Plus, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  invoiceAmount: string | null;
  paymentsReceived: string;
  exclude: boolean;
  rowIndex: number | null;
}

interface InvoiceTableProps {
  orderId: string;
  onInvoiceChange?: () => void; // Callback to notify parent when invoices change
}

export default function InvoiceTable({ orderId, onInvoiceChange }: InvoiceTableProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Partial<Invoice>>({});

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
    const newInvoice: Partial<Invoice> = {
      id: `new-${Date.now()}`,
      invoiceNumber: '',
      invoiceDate: '',
      invoiceAmount: '',
      paymentsReceived: '0',
      exclude: false,
    };
    setInvoices([...invoices, newInvoice as Invoice]);
    setEditingId(newInvoice.id!);
    setEditingInvoice(newInvoice);
  };

  const handleEdit = (invoice: Invoice) => {
    setEditingId(invoice.id);
    setEditingInvoice({ ...invoice });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingInvoice({});
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

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceNumber: invoiceData.invoiceNumber || null,
          invoiceDate: invoiceData.invoiceDate || null,
          invoiceAmount: invoiceData.invoiceAmount || null,
          paymentsReceived: invoiceData.paymentsReceived || '0',
          exclude: invoiceData.exclude || false,
        }),
      });

      const data = await response.json();

      if (data.success) {
        await fetchInvoices(); // Refresh list
        setEditingId(null);
        setEditingInvoice({});
        // Notify parent to refresh invoice summary
        if (onInvoiceChange) {
          onInvoiceChange();
        }
      } else {
        setError(data.error || 'Failed to save invoice');
      }
    } catch (err) {
      console.error('Error saving invoice:', err);
      setError('Failed to save invoice');
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
        // Notify parent to refresh invoice summary
        if (onInvoiceChange) {
          onInvoiceChange();
        }
      } else {
        setError(data.error || 'Failed to delete invoice');
      }
    } catch (err) {
      console.error('Error deleting invoice:', err);
      setError('Failed to delete invoice');
    } finally {
      setSaving(null);
    }
  };

  const calculateStatus = (invoice: Partial<Invoice>): string => {
    const payments = parseFloat(invoice.paymentsReceived?.toString() || '0');
    const amount = parseFloat(invoice.invoiceAmount?.toString() || '0');

    if (payments > 0) return 'Paid';
    if (amount > 0) return 'Open';
    return '';
  };

  const calculateOpenBalance = (invoice: Partial<Invoice>): number => {
    const amount = parseFloat(invoice.invoiceAmount?.toString() || '0');
    const payments = parseFloat(invoice.paymentsReceived?.toString() || '0');
    return amount - payments;
  };

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Invoices</CardTitle>
            <CardDescription>Manage invoices for this order (Rows 354-391)</CardDescription>
          </div>
          <Button onClick={handleAddInvoice} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Invoice
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[80px]">Exclude</TableHead>
                <TableHead>Invoice No.</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Payments</TableHead>
                <TableHead className="text-right">Open Balance</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No invoices yet. Click "Add Invoice" to create one.
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
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{status || '—'}</TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Checkbox
                            checked={displayInvoice.exclude || false}
                            onCheckedChange={(checked) =>
                              setEditingInvoice({ ...editingInvoice, exclude: checked === true })
                            }
                          />
                        ) : (
                          displayInvoice.exclude ? 'Yes' : 'No'
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={displayInvoice.invoiceNumber || ''}
                            onChange={(e) =>
                              setEditingInvoice({ ...editingInvoice, invoiceNumber: e.target.value })
                            }
                            placeholder="Invoice No."
                            className="w-full"
                          />
                        ) : (
                          displayInvoice.invoiceNumber || '—'
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            type="date"
                            value={displayInvoice.invoiceDate ? new Date(displayInvoice.invoiceDate).toISOString().split('T')[0] : ''}
                            onChange={(e) =>
                              setEditingInvoice({ ...editingInvoice, invoiceDate: e.target.value })
                            }
                            className="w-full"
                          />
                        ) : (
                          displayInvoice.invoiceDate
                            ? new Date(displayInvoice.invoiceDate).toLocaleDateString()
                            : '—'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={displayInvoice.invoiceAmount || ''}
                            onChange={(e) =>
                              setEditingInvoice({ ...editingInvoice, invoiceAmount: e.target.value })
                            }
                            placeholder="0.00"
                            className="w-full text-right"
                          />
                        ) : (
                          displayInvoice.invoiceAmount
                            ? `$${parseFloat(displayInvoice.invoiceAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : '—'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={displayInvoice.paymentsReceived || '0'}
                            onChange={(e) =>
                              setEditingInvoice({ ...editingInvoice, paymentsReceived: e.target.value })
                            }
                            placeholder="0.00"
                            className="w-full text-right"
                          />
                        ) : (
                          `$${parseFloat(displayInvoice.paymentsReceived || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${openBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <div className="flex gap-2">
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
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(invoice)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
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
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

