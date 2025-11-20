'use client';

import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { validateOrderItemsTotal } from '@/lib/orderItemsValidation';
import type { OrderItem } from '@/lib/tableExtractor';
import type { StoredContract } from '@/lib/store/contractStore';

interface OrderItemsValidationAlertProps {
  contract: StoredContract;
  currentItems?: OrderItem[];
}

export default function OrderItemsValidationAlert({ contract, currentItems }: OrderItemsValidationAlertProps) {
  // Use currentItems if provided (from OrderTable), otherwise use contract.items
  // Re-validate whenever items change
  const validation = useMemo(() => {
    const itemsToValidate = currentItems && currentItems.length > 0 ? currentItems : contract.items;
    return validateOrderItemsTotal(itemsToValidate, contract.order.orderGrandTotal);
  }, [currentItems, contract.items, contract.order.orderGrandTotal]);
  
  // Only show alert if validation failed
  if (validation.isValid) {
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Order Items Total Mismatch</AlertTitle>
      <AlertDescription>
        <div className="space-y-2">
          <p>{validation.message}</p>
          <div className="text-sm space-y-1">
            <p>• Sum of Order Items Amounts: <strong>${validation.itemsTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
            <p>• Order Grand Total: <strong>${validation.orderGrandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
            <p>• Difference: <strong>${validation.difference.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
          </div>
          <p className="text-xs mt-2">Please review the Order Items table to ensure all items were parsed correctly.</p>
        </div>
      </AlertDescription>
    </Alert>
  );
}

