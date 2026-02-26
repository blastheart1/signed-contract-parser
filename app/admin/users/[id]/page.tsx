'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save, Key, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface User {
  id: string;
  username: string;
  email?: string | null;
  role: string | null;
  status: string;
  salesRepName?: string | null;
}

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    role: '',
    status: '',
    salesRepName: '',
  });

  useEffect(() => {
    if (userId === 'new') {
      setUser({
        id: 'new',
        username: '',
        email: '',
        role: null,
        status: 'pending',
        salesRepName: null,
      });
      setFormData({
        email: '',
        role: '',
        status: 'pending',
        salesRepName: '',
      });
      setLoading(false);
    } else {
      fetchUser();
    }
  }, [userId]);

  const fetchUser = async () => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`);
      const data = await response.json();

      if (!data.success) {
        router.push('/admin/users');
        return;
      }

      setUser(data.user);
      setFormData({
        email: data.user.email || '',
        role: data.user.role || '',
        status: data.user.status,
        salesRepName: data.user.salesRepName || '',
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      router.push('/admin/users');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      if (formData.role === 'vendor' && !formData.email?.trim()) {
        setError('Email is required for vendor users');
        setSaving(false);
        return;
      }

      const url = userId === 'new' ? '/api/admin/users' : `/api/admin/users/${userId}`;
      const method = userId === 'new' ? 'POST' : 'PATCH';

      const body: any = {
        ...formData,
      };

      if (userId === 'new') {
        const username = prompt('Enter username:');
        const password = prompt('Enter password:');
        if (!username || !password) {
          setError('Username and password are required');
          setSaving(false);
          return;
        }
        body.username = username;
        body.password = password;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to save user');
        setSaving(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/admin/users');
      }, 1500);
    } catch (error) {
      console.error('Error saving user:', error);
      setError('Error saving user');
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    const isTemporary = confirm('Set temporary password? (User will need to change it on next login)');
    const newPassword = prompt('Enter new password:');

    if (!newPassword) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPassword,
          temporary: isTemporary,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(data.message || 'Password reset successfully');
      } else {
        alert(data.error || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      alert('Error resetting password');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <Link href="/admin/users">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Users
          </Button>
        </Link>
        <h1 className="text-4xl font-bold tracking-tight">
          {userId === 'new' ? 'Create User' : `Edit User: ${user?.username}`}
        </h1>
        <p className="text-muted-foreground mt-2">
          {userId === 'new' ? 'Create a new user account' : 'Update user information and permissions'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Information</CardTitle>
          <CardDescription>
            {userId === 'new' ? 'Enter user details to create a new account' : 'Update user details and permissions'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert>
                <AlertDescription>User saved successfully! Redirecting...</AlertDescription>
              </Alert>
            )}

            {user?.status === 'pending' && (
              <Alert className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                  This user is pending approval. Assign a role and set status to "Active" to approve the registration.
                </AlertDescription>
              </Alert>
            )}

            {userId !== 'new' && (
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={user?.username || ''} disabled />
                <p className="text-sm text-muted-foreground">Username cannot be changed</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">{formData.role === 'vendor' ? 'Email *' : 'Email'}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@example.com"
                required={formData.role === 'vendor'}
              />
              {formData.role === 'vendor' && (
                <p className="text-sm text-muted-foreground">Must match the vendor&apos;s email in the Vendor List.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="contract_manager">Contract Manager</SelectItem>
                  <SelectItem value="sales_rep">Sales Rep</SelectItem>
                  <SelectItem value="accountant">Accountant</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.role === 'sales_rep' && (
              <div className="space-y-2">
                <Label htmlFor="salesRepName">Sales Rep Name</Label>
                <Input
                  id="salesRepName"
                  value={formData.salesRepName}
                  onChange={(e) => setFormData({ ...formData, salesRepName: e.target.value })}
                  placeholder="Name matching orders.sales_rep field"
                />
                <p className="text-sm text-muted-foreground">
                  This name should match the sales_rep field in orders
                </p>
              </div>
            )}

            <div className="flex justify-between">
              <div>
                {userId !== 'new' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResetPassword}
                  >
                    <Key className="mr-2 h-4 w-4" />
                    Reset Password
                  </Button>
                )}
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

