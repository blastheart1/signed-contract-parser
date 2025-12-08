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

  const filteredCustomers = customers.filter((customer) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      customer.clientName.toLowerCase().includes(searchLower) ||
      customer.dbxCustomerId?.toLowerCase().includes(searchLower) ||
      customer.streetAddress.toLowerCase().includes(searchLower) ||
      customer.city.toLowerCase().includes(searchLower)
    );
  });

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
            <CardTitle>Search Customers</CardTitle>
            <CardDescription>
              Search by name, ID, address, or city
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
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
                      <TableHead>Status</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Contracts</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.map((customer, index) => (
                      <motion.tr
                        key={customer.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="border-b transition-colors hover:bg-muted/50"
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
                            <Badge variant="secondary">{customer.dbxCustomerId}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {customer.status === 'completed' ? (
                            <Badge variant="default" className="bg-green-600">Completed</Badge>
                          ) : (
                            <Badge variant="secondary">Pending Updates</Badge>
                          )}
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
                          <Badge>{customer.contractCount}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {showTrash ? (
                            <RecoverCustomerButton 
                              customerId={customer.id} 
                              onRecover={fetchCustomers}
                            />
                          ) : (
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/dashboard/customers/${customer.id}`}>
                                View
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                        </TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <UploadContractModal open={uploadModalOpen} onOpenChange={setUploadModalOpen} />
    </div>
  );
}
