'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, Plus, ArrowRight, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
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
import UploadContractModal from '@/components/dashboard/UploadContractModal';
import RecoverCustomerButton from '@/components/dashboard/RecoverCustomerButton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Pagination } from '@/components/ui/pagination';

interface Customer {
  id: string;
  dbxCustomerId?: string;
  clientName: string;
  email?: string;
  phone?: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  status?: 'pending_updates' | 'completed' | null;
  stage?: 'waiting_for_permit' | 'active' | 'completed' | null;
  contractCount: number;
  hasValidationIssues?: boolean;
  validationIssues?: string[];
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      // Fetch from customers API with status filter and trash option
      let url = '/api/customers';
      const params = new URLSearchParams();
      
      if (showTrash) {
        params.append('trashOnly', 'true');
      } else {
        params.append('includeDeleted', 'false');
      }
      
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      
      if (params.toString()) {
        url += '?' + params.toString();
      }
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.success) {
        setCustomers(data.customers || []);
      } else {
        console.error('Failed to fetch customers:', data.error);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [statusFilter, showTrash]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, showTrash]);

  const filteredCustomers = customers.filter((customer) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      customer.clientName.toLowerCase().includes(searchLower) ||
      customer.dbxCustomerId?.toLowerCase().includes(searchLower) ||
      customer.streetAddress.toLowerCase().includes(searchLower) ||
      customer.city.toLowerCase().includes(searchLower)
    );
  });

  // Calculate pagination
  const effectivePageSize = pageSize === 'all' ? filteredCustomers.length : pageSize;
  const totalPages = pageSize === 'all' ? 1 : Math.ceil(filteredCustomers.length / pageSize);
  const startIndex = (currentPage - 1) * effectivePageSize;
  const endIndex = startIndex + effectivePageSize;
  const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">
            {showTrash ? 'Trash' : 'Customers'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {showTrash 
              ? 'Recover or permanently delete customers'
              : 'Manage and view all your customers'}
          </p>
        </div>
        <div className="flex gap-2">
          {showTrash ? (
            <Button variant="outline" onClick={() => setShowTrash(false)}>
              <ArrowRight className="mr-2 h-4 w-4" />
              Back to Customers
            </Button>
          ) : (
            <>
              
              <Button onClick={() => setUploadModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Upload Contract
              </Button>
            </>
          )}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{showTrash ? 'Deleted Customers' : 'All Customers'}</CardTitle>
                <CardDescription>
                  {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''} found
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchCustomers} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search customers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending_updates">Pending Updates</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">
                    {searchTerm ? 'No customers found matching your search.' : 'No customers found.'}
                  </p>
                  {searchTerm && (
                    <Button variant="outline" onClick={() => setSearchTerm('')}>
                      Clear search
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>DBX ID</TableHead>
                      <TableHead className="text-center">Stage</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Overall Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCustomers.map((customer, index) => (
                      <TooltipProvider key={customer.id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <motion.tr
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.3, delay: index * 0.05 }}
                              onClick={() => {
                                if (!showTrash && customer.id) {
                                  window.location.href = `/dashboard/customers/${customer.id}`;
                                }
                              }}
                              className={`border-b transition-colors duration-150 hover:bg-green-200 dark:hover:bg-green-800/40 hover:shadow-sm ${!showTrash ? 'cursor-pointer' : ''}`}
                            >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {customer.clientName}
                            {customer.hasValidationIssues && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1">
                                      <p className="font-semibold">Detail Mismatch Detected</p>
                                      <p className="text-xs">This customer needs to be checked due to detail mismatch.</p>
                                      {customer.validationIssues && customer.validationIssues.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                          <p className="text-xs font-medium">Issues:</p>
                                          <ul className="text-xs list-disc list-inside">
                                            {customer.validationIssues.map((issue, idx) => (
                                              <li key={idx}>{issue}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {customer.dbxCustomerId ? (
                            <Badge variant="secondary" className="min-w-[80px] text-center flex items-center justify-center">{customer.dbxCustomerId}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={
                              customer.stage === 'active'
                                ? 'default'
                                : customer.stage === 'waiting_for_permit'
                                ? 'secondary'
                                : customer.stage === 'completed'
                                ? 'default'
                                : 'outline'
                            }
                            className={`min-w-[160px] text-center flex items-center justify-center ${
                              customer.stage === 'active'
                                ? 'bg-green-600 hover:bg-green-700'
                                : customer.stage === 'waiting_for_permit'
                                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                                : customer.stage === 'completed'
                                ? 'bg-blue-600 hover:bg-blue-700'
                                : ''
                            }`}
                          >
                            {customer.stage === 'waiting_for_permit'
                              ? 'Waiting for Permit'
                              : customer.stage === 'active'
                              ? 'Active'
                              : customer.stage === 'completed'
                              ? 'Completed'
                              : 'No Stage'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>{customer.streetAddress}</div>
                          <div className="text-sm text-muted-foreground">
                            {customer.city}, {customer.state} {customer.zip}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{customer.email || '-'}</div>
                          <div className="text-sm text-muted-foreground">{customer.phone || '-'}</div>
                        </TableCell>
                        <TableCell>
                          {customer.status === 'completed' ? (
                            <Badge variant="default" className="bg-green-600 min-w-[160px] text-center flex items-center justify-center">Completed</Badge>
                          ) : (
                            <Badge variant="secondary" className="min-w-[160px] text-center flex items-center justify-center">Pending Updates</Badge>
                          )}
                        </TableCell>
                            </motion.tr>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{!showTrash ? 'Click to view/edit customer' : ''}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
              
              {/* Pagination */}
              {filteredCustomers.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  totalItems={filteredCustomers.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setCurrentPage(1); // Reset to first page when page size changes
                  }}
                  pageSizeOptions={[10, 30, 50]}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <UploadContractModal open={uploadModalOpen} onOpenChange={setUploadModalOpen} />
    </div>
  );
}
