'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FolderOpen } from 'lucide-react';
import SortableTableHeaderArrowOnly from '@/components/dashboard/SortableTableHeaderArrowOnly';
import { sortData, type SortState, type SortDirection } from '@/lib/utils/tableSorting';

interface Project {
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
}

interface CategoryProjectsListProps {
  projects: Project[];
}

export default function CategoryProjectsList({ projects }: CategoryProjectsListProps) {
  const [sortState, setSortState] = useState<SortState<Project>>({ column: null, direction: null });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getStageBadge = (stage: string | null) => {
    if (!stage) return <Badge variant="outline">Unknown</Badge>;
    if (stage === 'active') {
      return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Active</Badge>;
    }
    if (stage === 'waiting_for_permit') {
      return <Badge variant="secondary" className="bg-orange-500 hover:bg-orange-600 text-white">Waiting for Permit</Badge>;
    }
    if (stage === 'completed') {
      return <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">Completed</Badge>;
    }
    return <Badge variant="secondary">{stage}</Badge>;
  };

  const handleSortChange = (column: keyof Project, direction: SortDirection) => {
    setSortState({ column, direction });
  };

  const processedProjects = useMemo(() => {
    return sortData(projects, sortState, (item, column) => {
      switch (column) {
        case 'orderNo':
          return item.orderNo;
        case 'customerName':
          return item.customerName;
        case 'totalWorkAssigned':
          return item.totalWorkAssigned;
        case 'profitability':
          return item.profitability;
        case 'profitMargin':
          return item.profitMargin;
        case 'costVariancePercentage':
          return item.costVariancePercentage;
        case 'stage':
          return item.stage || '';
        default:
          return item[column];
      }
    });
  }, [projects, sortState]);

  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Projects Using Category
          </CardTitle>
          <CardDescription>Projects that use this category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No projects found for this category
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          Projects Using Category
        </CardTitle>
        <CardDescription>All projects using this category with performance metrics</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHeaderArrowOnly
                  column="orderNo"
                  title="Order No"
                  currentSort={sortState}
                  onSortChange={handleSortChange}
                />
                <SortableTableHeaderArrowOnly
                  column="customerName"
                  title="Customer"
                  currentSort={sortState}
                  onSortChange={handleSortChange}
                />
                <SortableTableHeaderArrowOnly
                  column="totalWorkAssigned"
                  title="Work Assigned"
                  currentSort={sortState}
                  onSortChange={handleSortChange}
                  className="text-right"
                />
                <SortableTableHeaderArrowOnly
                  column="profitability"
                  title="Profitability"
                  currentSort={sortState}
                  onSortChange={handleSortChange}
                  className="text-right"
                />
                <SortableTableHeaderArrowOnly
                  column="profitMargin"
                  title="Margin"
                  currentSort={sortState}
                  onSortChange={handleSortChange}
                  className="text-right"
                />
                <SortableTableHeaderArrowOnly
                  column="costVariancePercentage"
                  title="Cost Variance"
                  currentSort={sortState}
                  onSortChange={handleSortChange}
                  className="text-right"
                />
                <TableHead className="border-l-2 border-border text-center">Stage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedProjects.map((project) => (
                <TableRow 
                  key={project.orderId} 
                  className="hover:bg-green-200 dark:hover:bg-green-800/40 hover:shadow-sm transition-colors duration-150"
                >
                  <TableCell className="font-medium">
                    <Link 
                      href={`/dashboard/customers/${project.customerId}`}
                      className="hover:underline cursor-pointer"
                    >
                      {project.orderNo}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link 
                      href={`/dashboard/customers/${project.customerId}`}
                      className="hover:underline cursor-pointer"
                    >
                      {project.customerName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(project.totalWorkAssigned)}</TableCell>
                  <TableCell className={`text-right font-semibold ${project.profitability >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(project.profitability)}
                  </TableCell>
                  <TableCell className={`text-right ${project.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercent(project.profitMargin)}
                  </TableCell>
                  <TableCell className={`text-right ${project.costVariancePercentage >= -5 ? 'text-green-600' : project.costVariancePercentage >= -10 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {formatPercent(project.costVariancePercentage)}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStageBadge(project.stage)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

