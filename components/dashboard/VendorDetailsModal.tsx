'use client';

import { useState, useEffect } from 'react';
import { Save, X, Loader2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface Vendor {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  contactPerson?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  category?: string | null;
  status: 'active' | 'inactive';
  notes?: string | null;
  specialties?: string[] | null;
}

interface VendorDetailsModalProps {
  vendor: Vendor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  viewOnly?: boolean;
}

export default function VendorDetailsModal({
  vendor,
  open,
  onOpenChange,
  onSave,
  viewOnly = false,
}: VendorDetailsModalProps) {
  const [vendorData, setVendorData] = useState<Vendor | null>(vendor);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setVendorData(vendor);
    setError(null);
  }, [vendor]);

  const handleSave = async () => {
    if (!vendorData) return;

    setSaving(true);
    setError(null);

    try {
      const url = vendorData.id ? `/api/vendors/${vendorData.id}` : '/api/vendors';
      const method = vendorData.id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: vendorData.name,
          email: vendorData.email || null,
          phone: vendorData.phone || null,
          contactPerson: vendorData.contactPerson || null,
          address: vendorData.address || null,
          city: vendorData.city || null,
          state: vendorData.state || null,
          zip: vendorData.zip || null,
          category: vendorData.category || null,
          status: vendorData.status,
          notes: vendorData.notes || null,
          specialties: vendorData.specialties || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save vendor');
      }

      toast({
        title: 'Success',
        description: vendorData.id ? 'Vendor updated successfully' : 'Vendor created successfully',
      });

      onSave();
      onOpenChange(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save vendor';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!vendorData) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {viewOnly ? 'Vendor Details' : vendorData.id ? 'Edit Vendor' : 'Add Vendor'}
          </DialogTitle>
          <DialogDescription>
            {viewOnly
              ? 'View vendor information'
              : vendorData.id
              ? 'Update vendor information'
              : 'Create a new vendor'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={vendorData.name}
                onChange={(e) => setVendorData({ ...vendorData, name: e.target.value })}
                placeholder="Vendor name"
                disabled={viewOnly}
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={vendorData.status}
                onValueChange={(value: 'active' | 'inactive') =>
                  setVendorData({ ...vendorData, status: value })
                }
                disabled={viewOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={vendorData.email || ''}
                onChange={(e) => setVendorData({ ...vendorData, email: e.target.value })}
                placeholder="vendor@example.com"
                disabled={viewOnly}
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={vendorData.phone || ''}
                onChange={(e) => setVendorData({ ...vendorData, phone: e.target.value })}
                placeholder="(555) 123-4567"
                disabled={viewOnly}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="contactPerson">Contact Person</Label>
            <Input
              id="contactPerson"
              value={vendorData.contactPerson || ''}
                onChange={(e) => setVendorData({ ...vendorData, contactPerson: e.target.value })}
                placeholder="Contact person name"
                disabled={viewOnly}
              />
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={vendorData.address || ''}
                onChange={(e) => setVendorData({ ...vendorData, address: e.target.value })}
                placeholder="Street address"
                disabled={viewOnly}
              />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={vendorData.city || ''}
                onChange={(e) => setVendorData({ ...vendorData, city: e.target.value })}
                placeholder="City"
                disabled={viewOnly}
              />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={vendorData.state || ''}
                onChange={(e) => setVendorData({ ...vendorData, state: e.target.value })}
                placeholder="State"
                disabled={viewOnly}
              />
            </div>
            <div>
              <Label htmlFor="zip">ZIP</Label>
              <Input
                id="zip"
                value={vendorData.zip || ''}
                onChange={(e) => setVendorData({ ...vendorData, zip: e.target.value })}
                placeholder="ZIP code"
                disabled={viewOnly}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={vendorData.category || ''}
                onChange={(e) => setVendorData({ ...vendorData, category: e.target.value })}
                placeholder="e.g., Plumbing, Electrical, Concrete"
                disabled={viewOnly}
              />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={vendorData.notes || ''}
                onChange={(e) => setVendorData({ ...vendorData, notes: e.target.value })}
                placeholder="Additional notes about this vendor"
                rows={3}
                disabled={viewOnly}
              />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            <X className="h-4 w-4 mr-2" />
            {viewOnly ? 'Close' : 'Cancel'}
          </Button>
          {!viewOnly && (
            <Button onClick={handleSave} disabled={saving || !vendorData.name.trim()}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

