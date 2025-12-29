'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import VendorInfo from '@/components/dashboard/VendorInfo';
import VendorAnalyticsCard from '@/components/dashboard/VendorAnalyticsCard';
import VendorTrendAnalysis from '@/components/dashboard/VendorTrendAnalysis';
import VendorEfficiencyMetrics from '@/components/dashboard/VendorEfficiencyMetrics';
import VendorProjectsList from '@/components/dashboard/VendorProjectsList';
import VendorRiskIndicators from '@/components/dashboard/VendorRiskIndicators';

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
  performanceMetrics?: {
    totalWorkAssigned: number;
    totalEstimatedCost: number;
    totalActualCost: number;
    totalProfitability: number;
    costVariance: number;
    costVariancePercentage: number;
    profitMargin: number;
    itemCount: number;
    projectCount: number;
    costAccuracyScore: number;
    profitabilityScore: number;
    reliabilityScore: number;
    overallPerformanceScore: number;
    riskLevel: 'low' | 'medium' | 'high';
  };
}

function VendorDetailContent() {
  const params = useParams();
  const router = useRouter();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVendor = useCallback(async () => {
    if (!params.id) {
      console.error('[VendorDetailPage] No params.id provided');
      setError('No vendor ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/vendors/${params.id}`);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch vendor: ${res.statusText}`);
      }

      const data = await res.json();

      if (data.success && data.data) {
        setVendor(data.data);
      } else {
        throw new Error(data.error || 'Vendor not found');
      }
    } catch (error) {
      console.error('[VendorDetailPage] Error fetching vendor:', error);
      setError(error instanceof Error ? error.message : 'Failed to load vendor');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchVendor();
  }, [fetchVendor]);

  const handleVendorUpdate = useCallback(async (updatedVendor: Vendor) => {
    setVendor(updatedVendor);
    // Refresh from server after a short delay to ensure update is saved
    setTimeout(() => {
      fetchVendor();
    }, 500);
  }, [fetchVendor]);

  const handleExportVendor = async () => {
    if (!vendor) return;

    try {
      const params = new URLSearchParams();
      params.append('vendorId', vendor.id);

      const url = `/api/vendors/export?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to export vendor');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `vendor-${vendor.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error exporting vendor:', error);
      alert('Failed to export vendor data');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading vendor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">Error: {error}</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/vendors">Back to Vendors</Link>
        </Button>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Vendor not found</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/vendors">Back to Vendors</Link>
        </Button>
      </div>
    );
  }

  const isDeleted = !!vendor.deletedAt;

  return (
    <div className="space-y-8">
      {/* Deleted Vendor Banner */}
      {isDeleted && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>This vendor has been deleted</AlertTitle>
            <AlertDescription>
              This vendor is in read-only mode. Restore it to make changes.
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex justify-between items-start"
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/vendors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Vendors
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button
            onClick={handleExportVendor}
            size="lg"
            variant="outline"
            className="gap-2"
          >
            <Download className="h-5 w-5" />
            Export CSV
          </Button>
        </div>
      </motion.div>

      {/* Vendor Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <VendorInfo 
          vendor={vendor}
          isDeleted={isDeleted}
          onVendorUpdate={handleVendorUpdate}
        />
      </motion.div>

      {/* Risk Indicators */}
      {vendor.performanceMetrics && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <VendorRiskIndicators vendor={vendor} />
        </motion.div>
      )}

      {/* Tabs: Overview, Analytics, Projects */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="mt-6 space-y-4">
            <VendorTrendAnalysis vendorId={vendor.id} />
            <VendorAnalyticsCard vendorId={vendor.id} view="category" />
          </TabsContent>
          
          <TabsContent value="analytics" className="mt-6 space-y-4">
            <VendorAnalyticsCard vendorId={vendor.id} view="category" />
            <VendorEfficiencyMetrics vendorId={vendor.id} />
          </TabsContent>
          
          <TabsContent value="projects" className="mt-6 space-y-4">
            <VendorProjectsList vendorId={vendor.id} vendorName={vendor.name} />
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}

export default function VendorDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <VendorDetailContent />
    </Suspense>
  );
}

