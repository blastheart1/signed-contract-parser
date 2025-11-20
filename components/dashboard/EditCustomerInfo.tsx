'use client';

import { useState, useRef } from 'react';
import { Save, X, Loader2, Upload, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { StoredContract } from '@/lib/store/contractStore';

interface EditCustomerInfoProps {
  contract: StoredContract;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updatedContract: StoredContract) => void;
}

export default function EditCustomerInfo({ contract, open, onOpenChange, onSave }: EditCustomerInfoProps) {
  const [customerData, setCustomerData] = useState({
    dbxCustomerId: contract.customer.dbxCustomerId || '',
    clientName: contract.customer.clientName || '',
    email: contract.customer.email || '',
    phone: contract.customer.phone || '',
    streetAddress: contract.customer.streetAddress || '',
    city: contract.customer.city || '',
    state: contract.customer.state || '',
    zip: contract.customer.zip || '',
  });

  const [orderData, setOrderData] = useState({
    orderNo: contract.order.orderNo || '',
    orderDate: contract.order.orderDate || '',
    orderPO: contract.order.orderPO || '',
    orderDueDate: contract.order.orderDueDate || '',
    orderType: contract.order.orderType || '',
    orderDelivered: contract.order.orderDelivered || false,
    quoteExpirationDate: contract.order.quoteExpirationDate || '',
    orderGrandTotal: contract.order.orderGrandTotal || 0,
    progressPayments: contract.order.progressPayments || '',
    balanceDue: contract.order.balanceDue || 0,
    salesRep: contract.order.salesRep || '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const updatedContract: StoredContract = {
        ...contract,
        customer: {
          ...customerData,
        },
        order: {
          ...orderData,
          orderDelivered: orderData.orderDelivered,
          orderGrandTotal: parseFloat(orderData.orderGrandTotal.toString()) || 0,
          balanceDue: parseFloat(orderData.balanceDue.toString()) || 0,
        },
        isLocationParsed: true, // Mark as parsed after manual edit
      };

      // Update in database via API
      const response = await fetch(`/api/contracts/${contract.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedContract),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update contract');
      }

      // Also update localStorage if it exists
      try {
        const { LocalStorageStore } = await import('@/lib/store/localStorageStore');
        LocalStorageStore.updateContract(updatedContract);
      } catch (e) {
        console.warn('localStorage update failed:', e);
      }

      onSave(updatedContract);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.name.endsWith('.eml')) {
      setFile(selectedFile);
      setError(null);
    } else {
      setError('Please select a .eml file');
    }
  };

  const handleReParse = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setParsing(true);
    setError(null);

    try {
      // Read file as base64
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const result = e.target?.result as string;
          const base64Data = result.split(',')[1];

          // Call parse-contract API
          const response = await fetch('/api/parse-contract', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              file: base64Data,
              filename: file.name,
              returnData: true,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to parse contract');
          }

          const dataResult = await response.json();

          if (!dataResult.success || !dataResult.data) {
            throw new Error('Failed to parse contract data');
          }

          const { location, isLocationParsed, items, addendums } = dataResult.data;

          if (!isLocationParsed) {
            setError('Could not parse customer information from the contract file. Please fill in the fields manually.');
          } else {
            // IMPORTANT: Preserve the existing contract ID and customer ID when re-parsing
            // This ensures we update the existing contract instead of creating a new one
            const existingDbxCustomerId = contract.customer.dbxCustomerId || location.dbxCustomerId;
            
            // Update form fields with parsed data, but preserve existing customer ID if available
            setCustomerData({
              dbxCustomerId: existingDbxCustomerId || location.dbxCustomerId || '',
              clientName: location.clientName || '',
              email: location.email || '',
              phone: location.phone || '',
              streetAddress: location.streetAddress || '',
              city: location.city || '',
              state: location.state || '',
              zip: location.zip || '',
            });

            setOrderData({
              orderNo: location.orderNo || contract.order.orderNo || '',
              orderDate: location.orderDate || '',
              orderPO: location.orderPO || '',
              orderDueDate: location.orderDueDate || '',
              orderType: location.orderType || '',
              orderDelivered: location.orderDelivered || false,
              quoteExpirationDate: location.quoteExpirationDate || '',
              orderGrandTotal: location.orderGrandTotal || 0,
              progressPayments: location.progressPayments || '',
              balanceDue: location.balanceDue || 0,
              salesRep: location.salesRep || '',
            });

            // If items were parsed, we could optionally update them too
            // But for now, we'll just update customer/order info and let user save
            // The items can be updated separately if needed

            setError(null);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to parse contract file');
        } finally {
          setParsing(false);
        }
      };

      reader.onerror = () => {
        setError('Failed to read file');
        setParsing(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse contract file');
      setParsing(false);
    }
  };

  const handleCancel = () => {
    // Reset to original values
    setCustomerData({
      dbxCustomerId: contract.customer.dbxCustomerId || '',
      clientName: contract.customer.clientName || '',
      email: contract.customer.email || '',
      phone: contract.customer.phone || '',
      streetAddress: contract.customer.streetAddress || '',
      city: contract.customer.city || '',
      state: contract.customer.state || '',
      zip: contract.customer.zip || '',
    });
    setOrderData({
      orderNo: contract.order.orderNo || '',
      orderDate: contract.order.orderDate || '',
      orderPO: contract.order.orderPO || '',
      orderDueDate: contract.order.orderDueDate || '',
      orderType: contract.order.orderType || '',
      orderDelivered: contract.order.orderDelivered || false,
      quoteExpirationDate: contract.order.quoteExpirationDate || '',
      orderGrandTotal: contract.order.orderGrandTotal || 0,
      progressPayments: contract.order.progressPayments || '',
      balanceDue: contract.order.balanceDue || 0,
      salesRep: contract.order.salesRep || '',
    });
    setError(null);
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Customer & Job Information</DialogTitle>
          <DialogDescription>
            Update customer and job information manually or re-parse from a contract file.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md mt-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Re-parse Contract Section */}
        <div className="mt-4 p-4 border rounded-lg bg-muted/50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-semibold mb-1">Re-parse from Contract File</h4>
              <p className="text-xs text-muted-foreground">
                Upload a contract .eml file to automatically extract customer and job information
              </p>
            </div>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".eml"
                onChange={handleFileSelect}
                className="cursor-pointer"
              />
              {file && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {file.name}
                </p>
              )}
            </div>
            <Button
              onClick={handleReParse}
              disabled={!file || parsing}
              variant="outline"
              size="sm"
            >
              {parsing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Parse
                </>
              )}
            </Button>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="space-y-6">
          {/* Customer Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Customer Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dbxCustomerId">DBX Customer ID</Label>
                <Input
                  id="dbxCustomerId"
                  value={customerData.dbxCustomerId}
                  onChange={(e) => setCustomerData({ ...customerData, dbxCustomerId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientName">Client Name *</Label>
                <Input
                  id="clientName"
                  value={customerData.clientName}
                  onChange={(e) => setCustomerData({ ...customerData, clientName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={customerData.email}
                  onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={customerData.phone}
                  onChange={(e) => setCustomerData({ ...customerData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="streetAddress">Street Address *</Label>
                <Input
                  id="streetAddress"
                  value={customerData.streetAddress}
                  onChange={(e) => setCustomerData({ ...customerData, streetAddress: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={customerData.city}
                  onChange={(e) => setCustomerData({ ...customerData, city: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State *</Label>
                <Input
                  id="state"
                  value={customerData.state}
                  onChange={(e) => setCustomerData({ ...customerData, state: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">Zip *</Label>
                <Input
                  id="zip"
                  value={customerData.zip}
                  onChange={(e) => setCustomerData({ ...customerData, zip: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          {/* Job Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Job Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="orderNo">Order Number *</Label>
                <Input
                  id="orderNo"
                  value={orderData.orderNo}
                  onChange={(e) => setOrderData({ ...orderData, orderNo: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orderDate">Order Date</Label>
                <Input
                  id="orderDate"
                  type="date"
                  value={orderData.orderDate ? new Date(orderData.orderDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => setOrderData({ ...orderData, orderDate: e.target.value || '' })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orderPO">Order PO</Label>
                <Input
                  id="orderPO"
                  value={orderData.orderPO}
                  onChange={(e) => setOrderData({ ...orderData, orderPO: e.target.value || '' })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orderDueDate">Order Due Date</Label>
                <Input
                  id="orderDueDate"
                  type="date"
                  value={orderData.orderDueDate ? new Date(orderData.orderDueDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => setOrderData({ ...orderData, orderDueDate: e.target.value || '' })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orderType">Order Type</Label>
                <Input
                  id="orderType"
                  value={orderData.orderType}
                  onChange={(e) => setOrderData({ ...orderData, orderType: e.target.value || '' })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quoteExpirationDate">Quote Expiration Date</Label>
                <Input
                  id="quoteExpirationDate"
                  type="date"
                  value={orderData.quoteExpirationDate ? new Date(orderData.quoteExpirationDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => setOrderData({ ...orderData, quoteExpirationDate: e.target.value || '' })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orderGrandTotal">Order Grand Total *</Label>
                <Input
                  id="orderGrandTotal"
                  type="number"
                  step="0.01"
                  value={orderData.orderGrandTotal}
                  onChange={(e) => setOrderData({ ...orderData, orderGrandTotal: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="balanceDue">Balance Due *</Label>
                <Input
                  id="balanceDue"
                  type="number"
                  step="0.01"
                  value={orderData.balanceDue}
                  onChange={(e) => setOrderData({ ...orderData, balanceDue: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="progressPayments">Progress Payments</Label>
                <Input
                  id="progressPayments"
                  value={orderData.progressPayments}
                  onChange={(e) => setOrderData({ ...orderData, progressPayments: e.target.value || '' })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salesRep">Sales Rep</Label>
                <Input
                  id="salesRep"
                  value={orderData.salesRep}
                  onChange={(e) => setOrderData({ ...orderData, salesRep: e.target.value || '' })}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="orderDelivered"
                    checked={orderData.orderDelivered}
                    onChange={(e) => setOrderData({ ...orderData, orderDelivered: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="orderDelivered">Order Delivered</Label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={handleCancel} disabled={saving}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

