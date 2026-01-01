'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OrderItem } from '@/lib/tableExtractor';

interface VendorMetricsCardProps {
  orderId: string;
  items: OrderItem[];
  customerId?: string;
}

export default function VendorMetricsCard({ orderId, items, customerId }: VendorMetricsCardProps) {
  // Calculate Negotiated Vendor Cost: Sum of AMOUNT for rows that have a VENDOR NAME (non-empty)
  const negotiatedVendorCost = useMemo(() => {
    return items
      .filter(item => item.type === 'item' && item.vendorName1 && item.vendorName1.trim() !== '')
      .reduce((sum, item) => {
        const amount = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount || 0)) || 0;
        return sum + amount;
      }, 0);
  }, [items]);

  // Calculate Total Estimated Vendor Cost: Sum of all estimatedVendorCost values
  const totalEstimatedVendorCost = useMemo(() => {
    return items
      .filter(item => item.type === 'item')
      .reduce((sum, item) => {
        const estimatedCost = item.estimatedVendorCost !== undefined && item.estimatedVendorCost !== null
          ? (typeof item.estimatedVendorCost === 'number' ? item.estimatedVendorCost : parseFloat(String(item.estimatedVendorCost)) || 0)
          : 0;
        return sum + estimatedCost;
      }, 0);
  }, [items]);

  // Calculate Price Difference: Total Estimated Vendor Cost - Negotiated Vendor Cost
  const priceDifference = useMemo(() => {
    return totalEstimatedVendorCost - negotiatedVendorCost;
  }, [totalEstimatedVendorCost, negotiatedVendorCost]);

  const formatCurrency = (value: number): string => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <Card className="h-full max-h-[336px] flex flex-col">
      <CardHeader>
        <CardTitle>Vendor Metrics</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-y-auto">
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Negotiated Vendor Cost</div>
            <div className="text-2xl font-bold">
              {formatCurrency(negotiatedVendorCost)}
            </div>
            <div className="text-xs text-muted-foreground">
              Sum of AMOUNT for items with VENDOR NAME
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Price Difference</div>
            <div className={`text-2xl font-bold ${priceDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(priceDifference)}
            </div>
            <div className="text-xs text-muted-foreground">
              Estimated Vendor Cost - Negotiated Vendor Cost
            </div>
          </div>

          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Total Estimated Vendor Cost: {formatCurrency(totalEstimatedVendorCost)}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

