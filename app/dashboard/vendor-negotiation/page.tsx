'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, Plus, Eye, Trash2, RefreshCw, FileText } from 'lucide-react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Pagination } from '@/components/ui/pagination';
import SortableTableHeaderArrowOnly from '@/components/dashboard/SortableTableHeaderArrowOnly';
import { sortData, type SortState } from '@/lib/utils/tableSorting';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

type SortableColumn = 'reference_no' | 'vendor' | 'date_created' | 'stage';

interface OrderApproval {
  id: string;
  referenceNo: string;
  vendorId: string;
  vendorName: string | null;
  customerId: string;
  customerName: string | null;
  orderId: string;
  stage: 'draft' | 'sent' | 'negotiating' | 'approved';
  pmApproved: boolean;
  vendorApproved: boolean;
  dateCreated: string;
  sentAt: string | null;
  deletedAt: string | null;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STAGE_COLORS: Record<string, string> = {
  draft: 'bg-gray-500',
  sent: 'bg-blue-500',
  negotiating: 'bg-yellow-500',
  approved: 'bg-green-500',
};

const STAGE_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  negotiating: 'Negotiating',
  approved: 'Approved',
};

export default function VendorNegotiationPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string | null } | null>(null);
  const [approvals, setApprovals] = useState<OrderApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<string>('date_created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [showTrash, setShowTrash] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [approvalToDelete, setApprovalToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [vendors, setVendors] = useState<Array<{ id: string; name: string }>>([]);
  const [customers, setCustomers] = useState<Array<{ dbxCustomerId: string; clientName: string }>>([]);
  const { toast } = useToast();

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      if (showTrash) {
        params.append('trashOnly', 'true');
      } else {
        params.append('includeDeleted', 'false');
      }
      params.append('page', currentPage.toString());
      params.append('limit', pageSize.toString());
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      const response = await fetch(`/api/order-approvals?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setApprovals(data.data || []);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to fetch order approvals',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching approvals:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch order approvals',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [searchTerm, showTrash, currentPage, pageSize, sortBy, sortOrder, toast]);

  // Fetch user session on mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/session');
        const data = await response.json();
        if (data.success && data.user) {
          setUser(data.user);
        }
      } catch (error) {
        console.error('Error fetching user session:', error);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  // Load vendors, customers, and orders for create dialog
  useEffect(() => {
    if (createDialogOpen) {
      // Load vendors
      fetch('/api/vendors?status=active&pageSize=1000')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setVendors(data.data || []);
          }
        })
        .catch(err => console.error('Error loading vendors:', err));

      // Load customers
      fetch('/api/customers?includeDeleted=false')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setCustomers(data.customers || []);
          }
        })
        .catch(err => console.error('Error loading customers:', err));
    }
  }, [createDialogOpen]);


  const handleCreateApproval = async () => {
    if (!selectedVendor || !selectedCustomer) {
      toast({
        title: 'Error',
        description: 'Please select vendor and customer',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/order-approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: selectedVendor,
          customerId: selectedCustomer,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Order approval created successfully',
        });
        setCreateDialogOpen(false);
        setSelectedVendor('');
        setSelectedCustomer('');
        fetchApprovals();
        // Navigate to the new approval
        router.push(`/dashboard/vendor-negotiation/${data.data.id}`);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to create order approval',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating approval:', error);
      toast({
        title: 'Error',
        description: 'Failed to create order approval',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!approvalToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/order-approvals/${approvalToDelete}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Order approval deleted successfully',
        });
        setDeleteDialogOpen(false);
        setApprovalToDelete(null);
        fetchApprovals();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to delete order approval',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting approval:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete order approval',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleSortChange = (column: SortableColumn, direction: 'asc' | 'desc' | null) => {
    setSortBy(column);
    setSortOrder(direction || 'asc');
    setCurrentPage(1); // Reset to first page on sort
  };

  const sortState = {
    column: sortBy as SortableColumn | null,
    direction: sortOrder as 'asc' | 'desc' | null,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vendor Negotiation</h1>
          <p className="text-muted-foreground mt-1">
            Manage order approvals and vendor negotiations
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user?.role !== 'vendor' && !showTrash && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Order Approval
            </Button>
          )}
          {user?.role !== 'vendor' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTrash(!showTrash)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {showTrash ? 'Hide Trash' : 'Show Trash'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchApprovals}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Order Approvals</CardTitle>
              <CardDescription>
                {pagination.total} approval{pagination.total !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by reference or vendor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : approvals.length === 0 ? (
            <div
              onClick={showTrash ? undefined : () => setCreateDialogOpen(true)}
              className={`text-center py-12 transition-colors ${
                showTrash
                  ? 'text-muted-foreground cursor-default'
                  : 'cursor-pointer hover:bg-green-200 dark:hover:bg-green-800/40 hover:text-foreground'
              }`}
            >
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">
                {showTrash ? 'No deleted approvals found' : 'No order approvals found'}
              </p>
              {!showTrash && (
                <p className="text-sm text-muted-foreground">
                  Click here or use the "Create Order Approval" button to create one
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHeaderArrowOnly<{ reference_no: string; vendor: string; date_created: string; stage: string }>
                        column="reference_no"
                        title="Ref No"
                        currentSort={sortState}
                        onSortChange={handleSortChange}
                      />
                      <SortableTableHeaderArrowOnly<{ reference_no: string; vendor: string; date_created: string; stage: string }>
                        column="vendor"
                        title="Vendor"
                        currentSort={sortState}
                        onSortChange={handleSortChange}
                      />
                      <SortableTableHeaderArrowOnly<{ reference_no: string; vendor: string; date_created: string; stage: string }>
                        column="date_created"
                        title="Date Created"
                        currentSort={sortState}
                        onSortChange={handleSortChange}
                      />
                      <SortableTableHeaderArrowOnly<{ reference_no: string; vendor: string; date_created: string; stage: string }>
                        column="stage"
                        title="Stage"
                        currentSort={sortState}
                        onSortChange={handleSortChange}
                      />
                      <TableHead className="text-right w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvals.map((approval) => (
                      <TableRow 
                        key={approval.id}
                        onClick={() => router.push(`/dashboard/vendor-negotiation/${approval.id}`)}
                        className="cursor-pointer hover:bg-green-200 dark:hover:bg-green-800/40 hover:shadow-sm transition-colors duration-150"
                      >
                        <TableCell className="font-mono">
                          {approval.referenceNo}
                        </TableCell>
                        <TableCell>
                          {approval.vendorName || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {new Date(approval.dateCreated).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={STAGE_COLORS[approval.stage] || 'bg-gray-500'}
                          >
                            {STAGE_LABELS[approval.stage] || approval.stage}
                          </Badge>
                        </TableCell>
                        <TableCell 
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      router.push(`/dashboard/vendor-negotiation/${approval.id}`)
                                    }
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>View</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            {!approval.deletedAt && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setApprovalToDelete(approval.id);
                                        setDeleteDialogOpen(true);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Items per page:</span>
                    <Select
                      value={pageSize.toString()}
                      onValueChange={(value) => {
                        setPageSize(parseInt(value, 10));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Pagination
                    currentPage={pagination.page}
                    totalItems={pagination.total}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(size) => {
                      setPageSize(size === 'all' ? pagination.total : size);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order Approval</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this order approval? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Order Approval</DialogTitle>
            <DialogDescription>
              Select vendor and customer to create a new approval. You will select order items in the detail view.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor *</Label>
              <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                <SelectTrigger id="vendor">
                  <SelectValue placeholder="Select a vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer">Customer *</Label>
              <Select
                value={selectedCustomer}
                onValueChange={setSelectedCustomer}
              >
                <SelectTrigger id="customer">
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.dbxCustomerId} value={customer.dbxCustomerId}>
                      {customer.clientName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setSelectedVendor('');
                setSelectedCustomer('');
              }}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateApproval} disabled={creating || !selectedVendor || !selectedCustomer}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

