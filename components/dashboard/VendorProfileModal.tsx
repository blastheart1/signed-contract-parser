'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle } from 'lucide-react';
import type { User } from './Sidebar';

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

interface VendorProfileModalProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function VendorProfileModal({ user, open, onOpenChange }: VendorProfileModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetchingVendor, setFetchingVendor] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  
  const [formData, setFormData] = useState({
    email: user.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    // Vendor fields
    phone: '',
    contactPerson: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    category: '',
    notes: '',
    specialties: [] as string[],
  });

  // Fetch vendor data when modal opens
  useEffect(() => {
    if (open && user.role === 'vendor') {
      fetchVendorData();
      setChangingPassword(false);
      setError(null);
    }
  }, [open, user]);

  const fetchVendorData = async () => {
    setFetchingVendor(true);
    try {
      const response = await fetch('/api/users/vendor');
      const data = await response.json();
      
      if (data.success && data.data) {
        const vendorData = data.data;
        setVendor(vendorData);
        setFormData((prev) => ({
          ...prev,
          phone: vendorData.phone || '',
          contactPerson: vendorData.contactPerson || '',
          address: vendorData.address || '',
          city: vendorData.city || '',
          state: vendorData.state || '',
          zip: vendorData.zip || '',
          category: vendorData.category || '',
          notes: vendorData.notes || '',
          specialties: vendorData.specialties || [],
        }));
      } else {
        // Vendor profile not found - that's okay, user can still update password
        setVendor(null);
      }
    } catch (error) {
      console.error('Error fetching vendor data:', error);
      // Don't show error - vendor profile might not exist yet
    } finally {
      setFetchingVendor(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation for password change
    if (changingPassword) {
      if (!formData.currentPassword) {
        setError('Current password is required to change password');
        return;
      }
      if (!formData.newPassword) {
        setError('New password is required');
        return;
      }
      if (formData.newPassword.length < 6) {
        setError('New password must be at least 6 characters long');
        return;
      }
      if (formData.newPassword !== formData.confirmPassword) {
        setError('New passwords do not match');
        return;
      }
    }

    setLoading(true);

    try {
      // Update password if changed
      if (changingPassword) {
        const passwordResponse = await fetch('/api/users/profile', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            currentPassword: formData.currentPassword,
            newPassword: formData.newPassword,
          }),
        });

        const passwordData = await passwordResponse.json();
        if (!passwordData.success) {
          setError(passwordData.error || 'Failed to update password');
          setLoading(false);
          return;
        }
      }

      // Update vendor profile if vendor exists
      if (vendor) {
        const vendorResponse = await fetch('/api/users/vendor', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone: formData.phone || null,
            contactPerson: formData.contactPerson || null,
            address: formData.address || null,
            city: formData.city || null,
            state: formData.state || null,
            zip: formData.zip || null,
            category: formData.category || null,
            notes: formData.notes || null,
            specialties: formData.specialties.length > 0 ? formData.specialties : null,
          }),
        });

        const vendorData = await vendorResponse.json();
        if (!vendorData.success) {
          setError(vendorData.error || 'Failed to update vendor profile');
          setLoading(false);
          return;
        }
      }

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });

      // Close modal and reset password change state
      setChangingPassword(false);
      setFormData((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
      onOpenChange(false);

      // Refresh the page to update user info in sidebar
      window.location.reload();
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setError(null);
    setChangingPassword(false);
    if (vendor) {
      setFormData((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        phone: vendor.phone || '',
        contactPerson: vendor.contactPerson || '',
        address: vendor.address || '',
        city: vendor.city || '',
        state: vendor.state || '',
        zip: vendor.zip || '',
        category: vendor.category || '',
        notes: vendor.notes || '',
        specialties: vendor.specialties || [],
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update your profile and vendor information. Email and username cannot be changed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {fetchingVendor && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground">Loading vendor information...</span>
            </div>
          )}

          {/* User Profile Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Account Information</h3>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
          </div>

          {/* Vendor Profile Section */}
          {vendor && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-lg font-semibold">Vendor Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="contactPerson">Contact Person</Label>
                  <Input
                    id="contactPerson"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder="Contact person name"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street address"
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="City"
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="State"
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="zip">ZIP</Label>
                  <Input
                    id="zip"
                    value={formData.zip}
                    onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                    placeholder="ZIP code"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Plumbing, Electrical, Concrete"
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes"
                  rows={3}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {!changingPassword ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setChangingPassword(true)}
              disabled={loading}
              className="w-full"
            >
              Change Password
            </Button>
          ) : (
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={formData.currentPassword}
                  onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                  disabled={loading}
                  required={changingPassword}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  disabled={loading}
                  required={changingPassword}
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  disabled={loading}
                  required={changingPassword}
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setChangingPassword(false);
                  setFormData((prev) => ({
                    ...prev,
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: '',
                  }));
                }}
                disabled={loading}
                className="w-full"
              >
                Cancel Password Change
              </Button>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

