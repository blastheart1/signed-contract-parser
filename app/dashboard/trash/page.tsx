'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Trash2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { StoredContract } from '@/lib/store/contractStore';

export default function TrashPage() {
  const [contracts, setContracts] = useState<StoredContract[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeletedContracts = async () => {
    setLoading(true);
    try {
      // Fetch all contracts
      const contractsRes = await fetch('/api/contracts');
      const contractsData = await contractsRes.json();
      
      if (contractsData.success) {
        // Filter to show only deleted contracts
        const deletedContracts = (contractsData.contracts || []).filter(
          (contract: StoredContract & { isDeleted?: boolean; deletedAt?: Date | null }) => 
            contract.isDeleted === true
        );
        
        // Sort by latest to oldest (by parsedAt or deletedAt)
        const sortedContracts = deletedContracts.sort(
          (a: StoredContract & { isDeleted?: boolean; deletedAt?: Date | null }, 
           b: StoredContract & { isDeleted?: boolean; deletedAt?: Date | null }) => {
            const dateA = a.deletedAt ? new Date(a.deletedAt).getTime() : (a.parsedAt ? new Date(a.parsedAt).getTime() : 0);
            const dateB = b.deletedAt ? new Date(b.deletedAt).getTime() : (b.parsedAt ? new Date(b.parsedAt).getTime() : 0);
            return dateB - dateA; // Latest first
          }
        );
        setContracts(sortedContracts);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching deleted contracts:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletedContracts();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5" />
                  Trash
                </CardTitle>
                <CardDescription>
                  Deleted contracts and entries. Click to view details.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchDeletedContracts} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {contracts.length === 0 ? (
              <div className="text-center py-12">
                <Trash2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No deleted contracts found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {contracts.map((contract, index) => {
                  const contractWithDeleted = contract as StoredContract & { isDeleted?: boolean; deletedAt?: Date | null };
                  
                  return (
                    <motion.div
                      key={contract.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <Link
                        href={`/dashboard/customers/${contract.id}?from=trash`}
                        className="block p-4 border rounded-lg hover:bg-accent transition-colors opacity-90 hover:opacity-100"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{contract.customer.clientName}</h3>
                              <Badge variant="secondary" className="gap-1">
                                <Trash2 className="h-3 w-3" />
                                Deleted
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Order #{contract.order.orderNo} • {contract.customer.streetAddress}
                            </p>
                            {contractWithDeleted.deletedAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Deleted: {new Date(contractWithDeleted.deletedAt).toLocaleDateString()}
                              </p>
                            )}
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
    </div>
  );
}

