/**
 * Client-safe validation functions for order items
 * These functions don't require Node.js dependencies like cheerio
 */

import type { OrderItem } from './tableExtractor';

/**
 * Calculate the sum of amounts from order items
 * Only includes items (not main categories or subcategories)
 * @param items - Array of order items
 * @returns Sum of all item amounts
 */
export function calculateOrderItemsTotal(items: OrderItem[]): number {
  if (!items || items.length === 0) {
    return 0;
  }

  let total = 0;
  for (const item of items) {
    // Only sum amounts from actual items (not main categories or subcategories)
    if (item.type === 'item' && item.amount !== null && item.amount !== undefined) {
      const amount = typeof item.amount === 'string' 
        ? parseFloat(item.amount.toString().replace(/[$,*]/g, '')) 
        : typeof item.amount === 'number' 
          ? item.amount 
          : 0;
      
      if (!isNaN(amount) && amount > 0) {
        total += amount;
      }
    }
  }

  return total;
}

/**
 * Validate that order items total matches the Order Grand Total
 * @param items - Array of order items
 * @param orderGrandTotal - Order Grand Total from location
 * @param tolerance - Allowed difference in cents (default: 0.01 for rounding differences)
 * @returns Validation result with match status and details
 */
export function validateOrderItemsTotal(
  items: OrderItem[],
  orderGrandTotal: number | undefined,
  tolerance: number = 0.01
): { isValid: boolean; itemsTotal: number; orderGrandTotal: number; difference: number; message?: string } {
  const itemsTotal = calculateOrderItemsTotal(items);
  
  if (!orderGrandTotal || orderGrandTotal === 0) {
    return {
      isValid: false,
      itemsTotal,
      orderGrandTotal: 0,
      difference: itemsTotal,
      message: 'Order Grand Total is missing or zero'
    };
  }

  const difference = Math.abs(itemsTotal - orderGrandTotal);
  const isValid = difference <= tolerance;

  if (!isValid) {
    const message = `Order items total ($${itemsTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) does not match Order Grand Total ($${orderGrandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). Difference: $${difference.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return {
      isValid: false,
      itemsTotal,
      orderGrandTotal,
      difference,
      message
    };
  }

  return {
    isValid: true,
    itemsTotal,
    orderGrandTotal,
    difference: 0
  };
}

