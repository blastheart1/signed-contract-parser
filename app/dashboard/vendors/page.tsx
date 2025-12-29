'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Search, Plus, RefreshCw, Trash2, Building2, Download, Upload, Edit, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import VendorAnalyticsCard from '@/components/dashboard/VendorAnalyticsCard';
import VendorDetailsModal from '@/components/dashboard/VendorDetailsModal';

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
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [showTrash, setShowTrash] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const fetchVendors = async () => {
    setLoading(true);
    try {
      let url = '/api/vendors';
      const params = new URLSearchParams();
      
      if (showTrash) {
        params.append('trashOnly', 'true');
      } else {
        params.append('includeDeleted', 'false');
      }
      
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      params.append('page', currentPage.toString());
      params.append('pageSize', pageSize === 'all' ? '1000' : pageSize.toString());
      
      if (params.toString()) {
        url += '?' + params.toString();
      }
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.success) {
        setVendors(data.data || []);
      } else {
        console.error('Failed to fetch vendors:', data.error);
        toast({
          title: 'Error',
          description: data.error || 'Failed to fetch vendors',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch vendors',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [statusFilter, showTrash, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, showTrash]);

  // Get unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set<string>();
    vendors.forEach(v => {
      if (v.category) {
        cats.add(v.category);
      }
    });
    return Array.from(cats).sort();
  }, [vendors]);

  // Filter vendors by search term (client-side for better UX)
  const filteredVendors = useMemo(() => {
    if (!searchTerm) return vendors;
    
    const searchLower = searchTerm.toLowerCase();
    return vendors.filter((vendor) => {
      return (
        vendor.name.toLowerCase().includes(searchLower) ||
        vendor.email?.toLowerCase().includes(searchLower) ||
        vendor.phone?.toLowerCase().includes(searchLower) ||
        vendor.category?.toLowerCase().includes(searchLower)
      );
    });
  }, [vendors, searchTerm]);

  // Calculate pagination
  const effectivePageSize = pageSize === 'all' ? filteredVendors.length : pageSize;
  const totalPages = pageSize === 'all' ? 1 : Math.ceil(filteredVendors.length / pageSize);
  const startIndex = (currentPage - 1) * effectivePageSize;
  const endIndex = startIndex + effectivePageSize;
  const paginatedVendors = filteredVendors.slice(startIndex, endIndex);

  const handleSeedVendors = async () => {
    try {
      const response = await fetch('/api/vendors/seed', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: 'Success',
          description: data.message || `Seeded ${data.created} vendors`,
        });
        fetchVendors();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to seed vendors',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error seeding vendors:', error);
      toast({
        title: 'Error',
        description: 'Failed to seed vendors',
        variant: 'destructive',
      });
    }
  };

  const handleAddVendor = () => {
    setSelectedVendor({
      id: '',
      name: '',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setIsCreating(true);
    setViewOnly(false);
    setModalOpen(true);
  };

  const handleEditVendor = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsCreating(false);
    setViewOnly(false);
    setModalOpen(true);
  };

  const [viewOnly, setViewOnly] = useState(false);

  const handleViewVendor = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsCreating(false);
    setViewOnly(true);
    setModalOpen(true);
  };

  const handleDeleteVendor = async (vendorId: string) => {
    if (!confirm('Are you sure you want to delete this vendor?')) {
      return;
    }

    try {
      const response = await fetch(`/api/vendors/${vendorId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Vendor deleted successfully',
        });
        fetchVendors();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to delete vendor',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting vendor:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete vendor',
        variant: 'destructive',
      });
    }
  };

  const handleExportVendors = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (showTrash) {
        params.append('includeDeleted', 'true');
      }

      const url = `/api/vendors/export${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to export vendors');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `vendors-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      toast({
        title: 'Success',
        description: 'Vendors exported successfully',
      });
    } catch (error) {
      console.error('Error exporting vendors:', error);
      toast({
        title: 'Error',
        description: 'Failed to export vendors',
        variant: 'destructive',
      });
    }
  };

  const handleImportVendors = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/vendors/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: data.message || `Imported ${data.created} vendors`,
        });
        fetchVendors();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to import vendors',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error importing vendors:', error);
      toast({
        title: 'Error',
        description: 'Failed to import vendors',
        variant: 'destructive',
      });
    } finally {
      // Reset file input
      event.target.value = '';
    }
  };

  if (loading && vendors.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading vendors...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8" />
              Vendors
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage vendor information and track performance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSeedVendors}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Seed from CSV
            </Button>
            <label className="cursor-pointer">
              <Button
                variant="outline"
                asChild
                className="flex items-center gap-2"
              >
                <span>
                  <Upload className="h-4 w-4" />
                  Import CSV
                </span>
              </Button>
              <input
                type="file"
                accept=".csv"
                onChange={handleImportVendors}
                className="hidden"
              />
            </label>
            <Button
              variant="outline"
              onClick={handleExportVendors}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              onClick={handleAddVendor}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Vendor
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Analytics Card */}
      <VendorAnalyticsCard />

      {/* Filters and Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Vendors List</CardTitle>
            <CardDescription>Search and filter vendors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search vendors by name, email, phone, or category..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch
                  checked={showTrash}
                  onCheckedChange={setShowTrash}
                />
                <span className="text-sm text-muted-foreground">Show Trash</span>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedVendors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        {loading ? 'Loading...' : 'No vendors found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedVendors.map((vendor, index) => (
                      <motion.tr
                        key={vendor.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className={`border-b transition-colors duration-150 ${!showTrash ? 'hover:bg-green-200 dark:hover:bg-green-800/40 hover:shadow-sm' : ''}`}
                      >
                        <TableCell className="font-medium">
                          {!showTrash ? (
                            <Link
                              href={`/dashboard/vendors/${vendor.id}`}
                              className="hover:underline"
                            >
                              {vendor.name}
                            </Link>
                          ) : (
                            vendor.name
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={vendor.status === 'active' ? 'default' : 'secondary'}>
                            {vendor.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {vendor.email && <div>{vendor.email}</div>}
                            {vendor.phone && <div className="text-muted-foreground">{vendor.phone}</div>}
                            {!vendor.email && !vendor.phone && (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditVendor(vendor);
                              }}
                              title="Edit vendor"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {!showTrash && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteVendor(vendor.id);
                                }}
                                title="Delete vendor"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {filteredVendors.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={filteredVendors.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1); // Reset to first page when page size changes
                }}
                pageSizeOptions={[10, 30, 50]}
              />
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Vendor Details Modal */}
      <VendorDetailsModal
        vendor={selectedVendor}
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setSelectedVendor(null);
            setViewOnly(false);
          }
        }}
        onSave={() => {
          fetchVendors();
          setSelectedVendor(null);
          setViewOnly(false);
        }}
        viewOnly={viewOnly}
      />
    </div>
  );
}

