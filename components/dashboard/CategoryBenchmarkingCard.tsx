'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, BarChart3, ArrowUp, ArrowDown } from 'lucide-react';

interface BenchmarkingData {
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
}

interface CategoryBenchmarkingCardProps {
  benchmarking: BenchmarkingData;
}

export default function CategoryBenchmarkingCard({ benchmarking }: CategoryBenchmarkingCardProps) {
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

  const calculateDifference = (category: number, overall: number) => {
    if (overall === 0) return 0;
    return ((category - overall) / Math.abs(overall)) * 100;
  };

  const profitMarginDiff = calculateDifference(benchmarking.categoryProfitMargin, benchmarking.overallAverageProfitMargin);
  const costVarianceDiff = calculateDifference(benchmarking.categoryCostVariance, benchmarking.overallAverageCostVariance);
  const volumeDiff = calculateDifference(benchmarking.categoryVolume, benchmarking.overallAverageVolume);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Benchmarking
        </CardTitle>
        <CardDescription>Category performance vs. overall average</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Profit Margin Comparison */}
          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Profit Margin</span>
              <div className={`text-xs flex items-center gap-1 ${benchmarking.isAboveAverage.profitMargin ? 'text-green-600' : 'text-red-600'}`}>
                {benchmarking.isAboveAverage.profitMargin ? (
                  <>
                    <ArrowUp className="h-3 w-3" />
                    Above Average
                  </>
                ) : (
                  <>
                    <ArrowDown className="h-3 w-3" />
                    Below Average
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">This Category</div>
                <div className={`text-xl font-bold ${benchmarking.categoryProfitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercent(benchmarking.categoryProfitMargin)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Overall Average</div>
                <div className="text-xl font-bold text-muted-foreground">
                  {formatPercent(benchmarking.overallAverageProfitMargin)}
                </div>
              </div>
            </div>
            <div className={`text-xs mt-2 ${profitMarginDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {profitMarginDiff >= 0 ? '+' : ''}{profitMarginDiff.toFixed(1)}% difference
            </div>
          </div>

          {/* Cost Variance Comparison */}
          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Cost Variance</span>
              <div className={`text-xs flex items-center gap-1 ${benchmarking.isAboveAverage.costVariance ? 'text-green-600' : 'text-yellow-600'}`}>
                {benchmarking.isAboveAverage.costVariance ? (
                  <>
                    <ArrowUp className="h-3 w-3" />
                    Better
                  </>
                ) : (
                  <>
                    <ArrowDown className="h-3 w-3" />
                    Worse
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">This Category</div>
                <div className={`text-xl font-bold ${benchmarking.categoryCostVariance >= -5 ? 'text-green-600' : benchmarking.categoryCostVariance >= -10 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {formatPercent(benchmarking.categoryCostVariance)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Overall Average</div>
                <div className="text-xl font-bold text-muted-foreground">
                  {formatPercent(benchmarking.overallAverageCostVariance)}
                </div>
              </div>
            </div>
            <div className={`text-xs mt-2 ${costVarianceDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {costVarianceDiff >= 0 ? '+' : ''}{costVarianceDiff.toFixed(1)}% difference
            </div>
          </div>

          {/* Volume Comparison */}
          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Work Volume</span>
              <div className={`text-xs flex items-center gap-1 ${benchmarking.isAboveAverage.volume ? 'text-green-600' : 'text-muted-foreground'}`}>
                {benchmarking.isAboveAverage.volume ? (
                  <>
                    <ArrowUp className="h-3 w-3" />
                    Above Average
                  </>
                ) : (
                  <>
                    <ArrowDown className="h-3 w-3" />
                    Below Average
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">This Category</div>
                <div className="text-xl font-bold">
                  {formatCurrency(benchmarking.categoryVolume)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Overall Average</div>
                <div className="text-xl font-bold text-muted-foreground">
                  {formatCurrency(benchmarking.overallAverageVolume)}
                </div>
              </div>
            </div>
            <div className={`text-xs mt-2 ${volumeDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {volumeDiff >= 0 ? '+' : ''}{volumeDiff.toFixed(1)}% difference
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

