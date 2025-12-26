'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Building2, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Project {
  orderId: string;
  orderNo: string;
  customerName: string;
  customerId: string;
  totalWorkAssigned: number;
  totalEstimatedCost: number;
  totalActualCost: number;
  profitability: number;
  profitMargin: number;
  projectStartDate?: string | null;
  projectEndDate?: string | null;
}

interface VendorProjectsListProps {
  vendorId: string;
  vendorName: string;
}

export default function VendorProjectsList({ vendorId, vendorName }: VendorProjectsListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/vendors/${vendorId}/projects?page=${page}&pageSize=${pageSize}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch projects');
        }

        const result = await response.json();

        if (result.success) {
          setProjects(result.data || []);
          setTotalPages(result.pagination?.totalPages || 1);
        } else {
          throw new Error(result.error || 'Failed to fetch projects');
        }
      } catch (err) {
        console.error('[VendorProjectsList] Error fetching projects:', err);
        setError(err instanceof Error ? err.message : 'Failed to load projects');
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [vendorId, page, pageSize]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Projects Using {vendorName}
          </CardTitle>
          <CardDescription>List of projects assigned to this vendor</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading projects...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Projects Using {vendorName}
          </CardTitle>
          <CardDescription>List of projects assigned to this vendor</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-destructive">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Projects Using {vendorName}
          </CardTitle>
          <CardDescription>List of projects assigned to this vendor</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No projects found. This vendor has not been assigned to any order items yet.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Projects Using {vendorName}
        </CardTitle>
        <CardDescription>
          {projects.length} project{projects.length !== 1 ? 's' : ''} found
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Work Assigned</TableHead>
                <TableHead className="text-right">Estimated Cost</TableHead>
                <TableHead className="text-right">Actual Cost</TableHead>
                <TableHead className="text-right">Profitability</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.orderId}>
                  <TableCell className="font-medium">
                    {project.orderNo}
                  </TableCell>
                  <TableCell>
                    {project.customerId ? (
                      <Link
                        href={`/dashboard/customers/${project.customerId}`}
                        className="text-primary hover:underline"
                      >
                        {project.customerName}
                      </Link>
                    ) : (
                      project.customerName
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(project.totalWorkAssigned)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(project.totalEstimatedCost)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(project.totalActualCost)}
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${project.profitability >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(project.profitability)}
                  </TableCell>
                  <TableCell className={`text-right ${project.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    <div className="flex items-center justify-end gap-1">
                      {project.profitMargin >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {formatPercent(project.profitMargin)}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

