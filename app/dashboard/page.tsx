'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Users, TrendingUp, ArrowRight, RefreshCw, Trash2, AlertCircle, CheckCircle2, Clock, FileText, DollarSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { StoredContract } from '@/lib/store/contractStore';
import UploadContractModal from '@/components/dashboard/UploadContractModal';

interface DashboardStats {
  totalCustomers: number;
  pendingUpdates: number;
  completed: number;
  totalValue: number;
  averageOrderValue: number;
  recentActivity: number; // Changes in last 7 days
  totalPaid: number;
}

export default function DashboardPage() {
  const [contracts, setContracts] = useState<StoredContract[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0,
    pendingUpdates: 0,
    completed: 0,
    totalValue: 0,
    averageOrderValue: 0,
    recentActivity: 0,
    totalPaid: 0,
  });
  const [paidPeriod, setPaidPeriod] = useState<'day' | 'week' | 'month' | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch contracts
      const contractsRes = await fetch('/api/contracts');
      const contractsData = await contractsRes.json();
      
      if (contractsData.success) {
        // Sort by latest to oldest (by parsedAt)
        const sortedContracts = (contractsData.contracts || []).sort((a: StoredContract & { isDeleted?: boolean; deletedAt?: Date | null }, b: StoredContract & { isDeleted?: boolean; deletedAt?: Date | null }) => {
          const dateA = a.parsedAt ? new Date(a.parsedAt).getTime() : 0;
          const dateB = b.parsedAt ? new Date(b.parsedAt).getTime() : 0;
          return dateB - dateA; // Latest first
        });
        setContracts(sortedContracts);
      }

      // Fetch customers for stats
      const customersRes = await fetch('/api/customers?includeDeleted=false');
      const customersData = await customersRes.json();
      
      if (customersData.success) {
        const customers = customersData.customers || [];
        const totalCustomers = customers.length;
        const pendingUpdates = customers.filter((c: any) => c.status === 'pending_updates').length;
        const completed = customers.filter((c: any) => c.status === 'completed').length;
        
        // Calculate total value and average
        const totalValue = contractsData.success 
          ? contractsData.contracts.reduce((sum: number, c: StoredContract) => sum + (c.order.orderGrandTotal || 0), 0)
          : 0;
        const averageOrderValue = contractsData.success && contractsData.contracts.length > 0
          ? totalValue / contractsData.contracts.length
          : 0;

        // Fetch recent activity (changes in last 7 days)
        const timelineRes = await fetch('/api/timeline?period=week&limit=1');
        const timelineData = await timelineRes.json();
        const recentActivity = timelineData.success ? timelineData.total : 0;

        // Fetch total paid for selected period
        const statsRes = await fetch(`/api/dashboard/stats?period=${paidPeriod}`);
        const statsData = await statsRes.json();
        const totalPaid = statsData.success ? statsData.totalPaid : 0;

        setStats({
          totalCustomers,
          pendingUpdates,
          completed,
          totalValue,
          averageOrderValue,
          recentActivity,
          totalPaid,
        });
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [paidPeriod]);

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Stats Cards Skeleton */}
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Additional Stats Row Skeleton */}
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-3 w-36" />
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Recent Contracts Skeleton */}
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
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
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
              <div className="text-2xl font-bold">{stats.totalCustomers}</div>
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
              <CardTitle className="text-sm font-medium">Pending Updates</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pendingUpdates}</div>
              <p className="text-xs text-muted-foreground">
                Need attention
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
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <p className="text-xs text-muted-foreground">
                Completed orders
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Combined order value
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Additional Stats Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Order Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats.averageOrderValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Per order average
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.6 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <div className="text-2xl font-bold">
                  ${stats.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <Select value={paidPeriod} onValueChange={(value) => setPaidPeriod(value as 'day' | 'week' | 'month' | 'all')}>
                  <SelectTrigger className="w-24 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="month">Last 30 Days</SelectItem>
                    <SelectItem value="week">Last 7 Days</SelectItem>
                    <SelectItem value="day">Today</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Payments received
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.7 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recentActivity}</div>
              <p className="text-xs text-muted-foreground">
                Changes in last 7 days
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
                <Button variant="outline" size="sm" onClick={fetchDashboardData} disabled={loading}>
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
