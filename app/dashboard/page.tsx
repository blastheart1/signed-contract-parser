'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Users, FileText, TrendingUp, ArrowRight, RefreshCw, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { contractStore } from '@/lib/store/contractStore';
import type { StoredContract } from '@/lib/store/contractStore';
import UploadContractModal from '@/components/dashboard/UploadContractModal';

export default function DashboardPage() {
  const [contracts, setContracts] = useState<StoredContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      // Try API first
      const res = await fetch('/api/contracts');
      const data = await res.json();
      
      if (data.success) {
        // Sort by latest to oldest (by parsedAt)
        const sortedContracts = (data.contracts || []).sort((a: StoredContract & { isDeleted?: boolean; deletedAt?: Date | null }, b: StoredContract & { isDeleted?: boolean; deletedAt?: Date | null }) => {
          const dateA = a.parsedAt ? new Date(a.parsedAt).getTime() : 0;
          const dateB = b.parsedAt ? new Date(b.parsedAt).getTime() : 0;
          return dateB - dateA; // Latest first
        });
        setContracts(sortedContracts);
        setLoading(false);
        return;
      }
      
      // Fallback to localStorage
      try {
        const { LocalStorageStore } = await import('@/lib/store/localStorageStore');
        const allContracts = LocalStorageStore.getAllContracts();
        // Sort by latest to oldest
        const sortedContracts = allContracts.sort((a, b) => {
          const dateA = a.parsedAt ? new Date(a.parsedAt).getTime() : 0;
          const dateB = b.parsedAt ? new Date(b.parsedAt).getTime() : 0;
          return dateB - dateA; // Latest first
        });
        setContracts(sortedContracts);
      } catch (localStorageError) {
        console.warn('localStorage fallback failed:', localStorageError);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching contracts:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  const customers = contractStore.getAllCustomers();
  const totalValue = contracts.reduce((sum, c) => sum + (c.order.orderGrandTotal || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your contracts and customers
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customers.length}</div>
              <p className="text-xs text-muted-foreground">
                Active customers
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contracts</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{contracts.length}</div>
              <p className="text-xs text-muted-foreground">
                Parsed contracts
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Combined order value
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Contracts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Contracts</CardTitle>
                <CardDescription>
                  Latest parsed contracts
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchContracts} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/dashboard/customers">
                    View All
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {contracts.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No contracts parsed yet.</p>
                <Button onClick={() => setUploadModalOpen(true)}>
                  Upload your first contract
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {contracts.slice(0, 5).map((contract, index) => {
                  const contractWithDeleted = contract as StoredContract & { isDeleted?: boolean; deletedAt?: Date | null };
                  const isDeleted = contractWithDeleted.isDeleted || false;
                  
                  return (
                    <motion.div
                      key={contract.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
                    >
                      <Link
                        href={`/dashboard/customers/${contract.id}`}
                        className={`block p-4 border rounded-lg hover:bg-accent transition-colors ${isDeleted ? 'opacity-60' : ''}`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{contract.customer.clientName}</h3>
                              {isDeleted && (
                                <Badge variant="secondary" className="gap-1">
                                  <Trash2 className="h-3 w-3" />
                                  Deleted
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Order #{contract.order.orderNo} • {contract.customer.streetAddress}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              ${contract.order.orderGrandTotal?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(contract.parsedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <UploadContractModal open={uploadModalOpen} onOpenChange={setUploadModalOpen} />
    </div>
  );
}
