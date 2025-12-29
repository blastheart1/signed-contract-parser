'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, TrendingDown, DollarSign, AlertCircle } from 'lucide-react';

interface Vendor {
  id: string;
  name: string;
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

interface VendorRiskIndicatorsProps {
  vendor: Vendor;
}

export default function VendorRiskIndicators({ vendor }: VendorRiskIndicatorsProps) {
  if (!vendor.performanceMetrics) {
    return null;
  }

  const metrics = vendor.performanceMetrics;
  const riskFactors: Array<{ type: string; severity: 'high' | 'medium' | 'low'; message: string; recommendation: string }> = [];

  // Check for negative profitability
  if (metrics.totalProfitability < 0) {
    riskFactors.push({
      type: 'negative_profitability',
      severity: 'high',
      message: `Vendor has negative profitability of $${Math.abs(metrics.totalProfitability).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      recommendation: 'Review vendor pricing and negotiate better rates or consider alternative vendors for future projects.',
    });
  }

  // Check for high cost variance (negative variance = over budget = bad)
  // Positive variance (under budget) is good, only flag if very large (estimation accuracy concern)
  if (metrics.costVariancePercentage < -15) {
    // Over budget by more than 15% = High risk
    riskFactors.push({
      type: 'high_variance',
      severity: 'high',
      message: `Cost variance is ${metrics.costVariancePercentage.toFixed(2)}% (over budget by more than 15%)`,
      recommendation: 'Vendor is significantly over budget. Investigate cost overruns and consider renegotiating or finding alternative vendors.',
    });
  } else if (metrics.costVariancePercentage < -10) {
    // Over budget by 10-15% = Medium risk
    riskFactors.push({
      type: 'moderate_variance',
      severity: 'medium',
      message: `Cost variance is ${metrics.costVariancePercentage.toFixed(2)}% (over budget by 10-15%)`,
      recommendation: 'Monitor cost estimates closely. Vendor is consistently over budget - review estimation process.',
    });
  } else if (metrics.costVariancePercentage > 30) {
    // Under budget by more than 30% = Monitor (estimation accuracy concern, but not bad)
    riskFactors.push({
      type: 'estimation_accuracy',
      severity: 'low',
      message: `Cost variance is +${metrics.costVariancePercentage.toFixed(2)}% (significantly under budget)`,
      recommendation: 'Vendor is significantly under budget. While favorable, this may indicate estimation accuracy issues. Review estimation process.',
    });
  }

  // Check for low profit margin
  if (metrics.profitMargin < 0) {
    riskFactors.push({
      type: 'negative_margin',
      severity: 'high',
      message: `Profit margin is ${metrics.profitMargin.toFixed(2)}% (negative)`,
      recommendation: 'Immediate action required. Review pricing strategy and vendor costs.',
    });
  } else if (metrics.profitMargin < 5) {
    riskFactors.push({
      type: 'low_margin',
      severity: 'medium',
      message: `Profit margin is ${metrics.profitMargin.toFixed(2)}% (below 5% threshold)`,
      recommendation: 'Consider adjusting pricing or negotiating better vendor rates to improve margins.',
    });
  }

  // Check for low utilization (if we had total work data)
  // This would require comparing vendor work to total work across all vendors
  // For now, we'll skip this check

  const getRiskBadgeVariant = (level: 'low' | 'medium' | 'high'): 'default' | 'secondary' | 'destructive' => {
    if (level === 'high') return 'destructive';
    if (level === 'medium') return 'secondary';
    return 'default';
  };

  const getRiskBadgeColor = (level: 'low' | 'medium' | 'high') => {
    if (level === 'high') return 'bg-red-600 hover:bg-red-700';
    if (level === 'medium') return 'bg-yellow-600 hover:bg-yellow-700';
    return 'bg-green-600 hover:bg-green-700';
  };

  if (riskFactors.length === 0 && metrics.riskLevel === 'low') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-green-600" />
            Risk Assessment
          </CardTitle>
          <CardDescription>Vendor risk indicators and recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
            <AlertCircle className="h-4 w-4 text-green-600" />
            <AlertTitle>Low Risk</AlertTitle>
            <AlertDescription>
              This vendor shows healthy performance metrics with no significant risk factors identified.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Risk Assessment
            </CardTitle>
            <CardDescription>Vendor risk indicators and recommendations</CardDescription>
          </div>
          <Badge 
            variant={getRiskBadgeVariant(metrics.riskLevel)} 
            className={`${getRiskBadgeColor(metrics.riskLevel)} text-white`}
          >
            {metrics.riskLevel.toUpperCase()} RISK
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {riskFactors.map((factor, index) => (
          <Alert
            key={index}
            variant={factor.severity === 'high' ? 'destructive' : 'default'}
            className={factor.severity === 'medium' ? 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800' : ''}
          >
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="flex items-center gap-2">
              {factor.severity === 'high' ? 'High Risk' : 'Medium Risk'}
              <Badge variant={factor.severity === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                {factor.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Badge>
            </AlertTitle>
            <AlertDescription className="mt-2">
              <div className="font-medium mb-1">{factor.message}</div>
              <div className="text-sm mt-2">
                <strong>Recommendation:</strong> {factor.recommendation}
              </div>
            </AlertDescription>
          </Alert>
        ))}

        {riskFactors.length === 0 && metrics.riskLevel === 'medium' && (
          <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle>Medium Risk</AlertTitle>
            <AlertDescription>
              This vendor has some performance metrics that require monitoring. Continue tracking performance closely.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

