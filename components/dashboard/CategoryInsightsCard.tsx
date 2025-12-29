'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, TrendingUp, AlertTriangle, Target, CheckCircle2 } from 'lucide-react';

interface Insight {
  type: 'vendor_selection' | 'cost_optimization' | 'risk_alert' | 'diversification';
  priority: 'high' | 'medium' | 'low';
  message: string;
}

interface TopPerformer {
  vendorName: string;
  profitability: number;
}

interface MostEfficient {
  vendorName: string;
  costVariance: number;
}

interface NeedsImprovement {
  vendorName: string;
  issues: string[];
}

interface CategoryInsightsCardProps {
  topPerformer: TopPerformer | null;
  mostEfficient: MostEfficient | null;
  needsImprovement: NeedsImprovement | null;
  recommendations: Insight[];
}

export default function CategoryInsightsCard({
  topPerformer,
  mostEfficient,
  needsImprovement,
  recommendations,
}: CategoryInsightsCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    if (priority === 'high') return 'text-red-600 bg-red-50 dark:bg-red-950';
    if (priority === 'medium') return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950';
    return 'text-blue-600 bg-blue-50 dark:bg-blue-950';
  };

  const getPriorityBadge = (priority: 'high' | 'medium' | 'low') => {
    if (priority === 'high') return <Badge variant="destructive" className="w-[80px] flex items-center justify-center">High</Badge>;
    if (priority === 'medium') return <Badge variant="secondary" className="bg-yellow-600 w-[80px] flex items-center justify-center">Medium</Badge>;
    return <Badge variant="default" className="bg-blue-600 w-[80px] flex items-center justify-center">Low</Badge>;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'vendor_selection':
        return <Target className="h-4 w-4" />;
      case 'cost_optimization':
        return <TrendingUp className="h-4 w-4" />;
      case 'risk_alert':
        return <AlertTriangle className="h-4 w-4" />;
      case 'diversification':
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return <Lightbulb className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Business Insights & Recommendations
        </CardTitle>
        <CardDescription>Actionable insights for this category</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Top Performers */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            Top Performers
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {topPerformer && (
              <div className="p-3 border rounded-lg bg-green-50 dark:bg-green-950/20">
                <div className="text-xs text-muted-foreground mb-1">Best Profitability</div>
                <div className="font-semibold">{topPerformer.vendorName}</div>
                <div className="text-sm text-green-600 mt-1">
                  {formatCurrency(topPerformer.profitability)} profitability
                </div>
              </div>
            )}
            {mostEfficient && (
              <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <div className="text-xs text-muted-foreground mb-1">Most Cost Efficient</div>
                <div className="font-semibold">{mostEfficient.vendorName}</div>
                <div className="text-sm text-blue-600 mt-1">
                  {mostEfficient.costVariance >= 0 ? '+' : ''}{mostEfficient.costVariance.toFixed(2)}% variance
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Needs Improvement */}
        {needsImprovement && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              Needs Improvement
            </h4>
            <div className="p-3 border rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200">
              <div className="font-semibold mb-1">{needsImprovement.vendorName}</div>
              <div className="text-sm text-muted-foreground">
                <ul className="list-disc list-inside space-y-1">
                  {needsImprovement.issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Recommendations
            </h4>
            <div className="space-y-2">
              {recommendations.map((rec, index) => (
                <div
                  key={index}
                  className={`p-3 border rounded-lg ${getPriorityColor(rec.priority)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      {getTypeIcon(rec.type)}
                      <div className="flex-1">
                        <div className="text-sm font-medium">{rec.message}</div>
                      </div>
                    </div>
                    <div className="w-[80px] flex justify-end">
                      {getPriorityBadge(rec.priority)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!topPerformer && !mostEfficient && !needsImprovement && recommendations.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No insights available for this category
          </div>
        )}
      </CardContent>
    </Card>
  );
}

