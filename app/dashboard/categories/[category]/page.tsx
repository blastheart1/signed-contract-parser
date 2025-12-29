'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CategoryInfo from '@/components/dashboard/CategoryInfo';
import CategoryVendorRankingTable from '@/components/dashboard/CategoryVendorRankingTable';
import CategoryInsightsCard from '@/components/dashboard/CategoryInsightsCard';
import CategoryBenchmarkingCard from '@/components/dashboard/CategoryBenchmarkingCard';
import CategoryVendorsList from '@/components/dashboard/CategoryVendorsList';
import CategoryProjectsList from '@/components/dashboard/CategoryProjectsList';

interface CategoryData {
  category: string;
  metrics: {
    totalWorkAssigned: number;
    totalEstimatedCost: number;
    totalActualCost: number;
    totalProfitability: number;
    profitMargin: number;
    costVariance: number;
    costVariancePercentage: number;
    itemCount: number;
    projectCount: number;
    vendorCount: number;
    averageProjectValue: number;
    averageProfitabilityPerProject: number;
    averageCostPerItem: number;
    costPerProject: number;
    costPerDollarWorkAssigned: number;
    profitableProjectsCount: number;
    unprofitableProjectsCount: number;
    profitableProjectsPercentage: number;
    unprofitableProjectsPercentage: number;
  };
  vendors: Array<{
    vendorName: string;
    rank: number;
    totalWorkAssigned: number;
    totalEstimatedCost: number;
    totalActualCost: number;
    totalProfitability: number;
    profitMargin: number;
    costVariance: number;
    costVariancePercentage: number;
    varianceStatus: 'acceptable' | 'monitor' | 'action_required';
    projectCount: number;
    itemCount: number;
    performanceScore: number;
    trend: 'improving' | 'declining' | 'stable';
    isTopPerformer: boolean;
    isMostEfficient: boolean;
    needsImprovement: boolean;
  }>;
  projects: Array<{
    orderId: string;
    orderNo: string;
    customerName: string;
    customerId: string;
    totalWorkAssigned: number;
    profitability: number;
    profitMargin: number;
    costVariance: number;
    costVariancePercentage: number;
    projectStartDate: string | null;
    projectEndDate: string | null;
    status: string | null;
    stage: string | null;
    isProfitable: boolean;
  }>;
  insights: {
    topPerformer: { vendorName: string; profitability: number } | null;
    mostEfficient: { vendorName: string; costVariance: number } | null;
    needsImprovement: { vendorName: string; issues: string[] } | null;
    recommendations: Array<{
      type: 'vendor_selection' | 'cost_optimization' | 'risk_alert' | 'diversification';
      priority: 'high' | 'medium' | 'low';
      message: string;
    }>;
  };
  benchmarking: {
    categoryProfitMargin: number;
    overallAverageProfitMargin: number;
    categoryCostVariance: number;
    overallAverageCostVariance: number;
    categoryVolume: number;
    overallAverageVolume: number;
    isAboveAverage: {
      profitMargin: boolean;
      costVariance: boolean;
      volume: boolean;
    };
  };
  trends: {
    volumeTrend: 'increasing' | 'decreasing' | 'stable';
    profitabilityTrend: 'increasing' | 'decreasing' | 'stable';
    costTrend: 'increasing' | 'decreasing' | 'stable';
  };
  distribution: {
    profitableProjectsPercentage: number;
    unprofitableProjectsPercentage: number;
    projectStatusDistribution: {
      active: number;
      completed: number;
      pending: number;
    };
  };
}

function CategoryDetailContent() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<CategoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategoryData = useCallback(async () => {
    if (!params.category) {
      console.error('[CategoryDetailPage] No category provided');
      setError('No category provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Category is already URL encoded in the route, but we need to ensure it's properly handled
      const categoryParam = Array.isArray(params.category) ? params.category[0] : params.category;
      const res = await fetch(`/api/categories/${categoryParam}`);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch category: ${res.statusText}`);
      }

      const result = await res.json();

      if (result.success && result.data) {
        setData(result.data);
      } else {
        throw new Error(result.error || 'Category not found');
      }
    } catch (error) {
      console.error('[CategoryDetailPage] Error fetching category:', error);
      setError(error instanceof Error ? error.message : 'Failed to load category');
    } finally {
      setLoading(false);
    }
  }, [params.category]);

  useEffect(() => {
    fetchCategoryData();
  }, [fetchCategoryData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading category...</p>
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

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Category not found</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/vendors">Back to Vendors</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
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
      </motion.div>

      {/* Category Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <CategoryInfo category={data.category} metrics={data.metrics} />
      </motion.div>

      {/* Tabs: Overview, Vendors, Projects */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="mt-6 space-y-4">
            <CategoryVendorRankingTable vendors={data.vendors} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CategoryInsightsCard
                topPerformer={data.insights.topPerformer}
                mostEfficient={data.insights.mostEfficient}
                needsImprovement={data.insights.needsImprovement}
                recommendations={data.insights.recommendations}
              />
              <CategoryBenchmarkingCard benchmarking={data.benchmarking} />
            </div>
          </TabsContent>
          
          <TabsContent value="vendors" className="mt-6 space-y-4">
            <CategoryVendorsList vendors={data.vendors} />
          </TabsContent>
          
          <TabsContent value="projects" className="mt-6 space-y-4">
            <CategoryProjectsList projects={data.projects} />
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}

export default function CategoryDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <CategoryDetailContent />
    </Suspense>
  );
}

