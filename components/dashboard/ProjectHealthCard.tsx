'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Calendar, TrendingDown, Clock } from 'lucide-react';
import Link from 'next/link';

interface Project {
  orderId: string;
  orderNo: string;
  customerId: string;
  clientName: string;
  orderDueDate?: Date | null;
  daysOverdue?: number;
  status: string;
  orderDate?: Date | null;
  daysSinceStart?: number;
  averageProgress?: number;
}

interface ProjectHealthData {
  overdueCount: number;
  overdueProjects: Project[];
  dueSoon7DaysCount: number;
  dueSoon7Days: Project[];
  dueSoon30DaysCount: number;
  dueSoon30Days: Project[];
  lowProgressCount: number;
  lowProgressProjects: Project[];
  averageCompletionTime: number;
}

export default function ProjectHealthCard() {
  const [data, setData] = useState<ProjectHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/dashboard/project-health');
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch project health');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Project Health</CardTitle>
          <CardDescription>Projects at risk and overdue analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Project Health</CardTitle>
          <CardDescription>Projects at risk and overdue analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-destructive">{error || 'Failed to load data'}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Project Health
        </CardTitle>
        <CardDescription>Projects at risk and overdue analysis</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-950">
            <div className="text-xs text-muted-foreground mb-1">Overdue</div>
            <div className="text-2xl font-bold text-red-600">{data.overdueCount}</div>
          </div>
          <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-950">
            <div className="text-xs text-muted-foreground mb-1">Due in 7 Days</div>
            <div className="text-2xl font-bold text-yellow-600">{data.dueSoon7DaysCount}</div>
          </div>
          <div className="p-4 border rounded-lg bg-orange-50 dark:bg-orange-950">
            <div className="text-xs text-muted-foreground mb-1">Due in 30 Days</div>
            <div className="text-2xl font-bold text-orange-600">{data.dueSoon30DaysCount}</div>
          </div>
          <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
            <div className="text-xs text-muted-foreground mb-1">Low Progress</div>
            <div className="text-2xl font-bold text-blue-600">{data.lowProgressCount}</div>
          </div>
        </div>

        {/* Average Completion Time */}
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Average Completion Time:</span>
            <span className="text-lg font-semibold">{data.averageCompletionTime} days</span>
          </div>
        </div>

        {/* Overdue Projects */}
        {data.overdueProjects.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Overdue Projects ({data.overdueCount})
            </h4>
            <div className="space-y-2">
              {data.overdueProjects.map((project) => (
                <Link
                  key={project.orderId}
                  href={`/dashboard/customers/${project.customerId}`}
                  className="block p-3 border rounded-lg hover:bg-accent"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{project.clientName}</div>
                      <div className="text-sm text-muted-foreground">Order #{project.orderNo}</div>
                    </div>
                    <Badge variant="destructive">
                      {project.daysOverdue} days overdue
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Due Soon (7 Days) */}
        {data.dueSoon7Days.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-yellow-600" />
              Due in Next 7 Days ({data.dueSoon7DaysCount})
            </h4>
            <div className="space-y-2">
              {data.dueSoon7Days.map((project) => (
                <Link
                  key={project.orderId}
                  href={`/dashboard/customers/${project.customerId}`}
                  className="block p-3 border rounded-lg hover:bg-accent"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{project.clientName}</div>
                      <div className="text-sm text-muted-foreground">Order #{project.orderNo}</div>
                    </div>
                    <Badge variant="outline" className="text-yellow-600">
                      Due Soon
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Low Progress Projects */}
        {data.lowProgressProjects.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-blue-600" />
              Low Progress Projects ({data.lowProgressCount})
            </h4>
            <div className="space-y-2">
              {data.lowProgressProjects.map((project) => (
                <Link
                  key={project.orderId}
                  href={`/dashboard/customers/${project.customerId}`}
                  className="block p-3 border rounded-lg hover:bg-accent"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{project.clientName}</div>
                      <div className="text-sm text-muted-foreground">
                        Order #{project.orderNo} • {project.daysSinceStart} days since start
                      </div>
                    </div>
                    <Badge variant="outline" className="text-blue-600">
                      {project.averageProgress}% progress
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

