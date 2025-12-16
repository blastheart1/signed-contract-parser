/**
 * Validation utilities for invoice line item linking
 */

export interface LinkedLineItem {
  orderItemId: string;
  thisBillAmount: number;
}

export interface OrderItemForValidation {
  id: string;
  amount: number | string | null;
  thisBill: number | string | null;
  progressOverallPct: number | string | null;
  previouslyInvoicedPct: number | string | null;
}

export interface ValidationError {
  orderItemId: string;
  reason: string;
}

/**
 * Parse decimal value from database (can be string or number)
 */
function parseDecimal(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Calculate thisBill from item data, using stored value or calculating from percentages
 * This matches the calculation logic in /api/orders/[id]/items
 */
export function calculateThisBill(item: OrderItemForValidation): number {
  let thisBill = 0;
  
  // Try to get stored thisBill value first
  thisBill = parseDecimal(item.thisBill);
  
  // If thisBill is 0 or missing, calculate it from percentages
  if ((!thisBill || thisBill === 0) && item.amount) {
    let newProgressPct = 0;
    
    // If newProgressPct is missing, calculate it from progressOverallPct - previouslyInvoicedPct
    // Handle cases where previouslyInvoicedPct is NULL/0 (treat as 0)
    const progressOverallPct = parseDecimal(item.progressOverallPct);
    const previouslyInvoicedPct = item.previouslyInvoicedPct !== null && item.previouslyInvoicedPct !== undefined
      ? parseDecimal(item.previouslyInvoicedPct)
      : 0;
    newProgressPct = progressOverallPct - previouslyInvoicedPct;
    
    // Calculate thisBill from newProgressPct and amount
    if (newProgressPct > 0 && item.amount) {
      const amount = parseDecimal(item.amount);
      if (!isNaN(newProgressPct) && !isNaN(amount) && amount > 0) {
        thisBill = (newProgressPct / 100) * amount;
      }
    }
  }
  
  return thisBill;
}

/**
 * Validate if an order item can be linked to an invoice with a specific amount
 * Simplified validation: focuses on cumulative total protection
 */
export function validateItemForLinkingWithAmount(
  item: OrderItemForValidation,
  invoiceAmount: number, // User-entered invoice amount for this item
  existingInvoiceAmounts: number = 0 // Sum of invoice amounts already linked to this item
): { valid: boolean; error?: string } {
  const amount = parseDecimal(item.amount);
  const progressOverallPct = parseDecimal(item.progressOverallPct);

  // Rule 1: Item must have Progress Overall % > 0
  if (progressOverallPct <= 0) {
    return {
      valid: false,
      error: 'Item must have Progress Overall % greater than 0',
    };
  }

  // Rule 2: Invoice amount must be > 0
  if (invoiceAmount <= 0) {
    return {
      valid: false,
      error: 'Invoice amount must be greater than 0',
    };
  }

  // Rule 3: Cannot exceed item's amount (hard limit)
  // The sum of all invoice amounts for this item cannot exceed the item's amount
  if (existingInvoiceAmounts + invoiceAmount > amount) {
    const remaining = amount - existingInvoiceAmounts;
    return {
      valid: false,
      error: `Would exceed item amount. Remaining billable: $${remaining.toFixed(2)}`,
    };
  }

  return { valid: true };
}

/**
 * Validate if an order item can be linked to an invoice (backward compatibility)
 * @deprecated Use validateItemForLinkingWithAmount for new code
 */
export function validateItemForLinking(
  item: OrderItemForValidation,
  existingInvoiceAmounts: number = 0 // Sum of invoice amounts already linked to this item
): { valid: boolean; error?: string } {
  // Calculate thisBill (may be from stored value or calculated from percentages)
  const thisBill = calculateThisBill(item);
  return validateItemForLinkingWithAmount(item, thisBill, existingInvoiceAmounts);
}

/**
 * Validate multiple items for linking
 */
export function validateItemsForLinking(
  items: OrderItemForValidation[],
  getExistingInvoiceAmounts: (itemId: string) => number
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const item of items) {
    const existingAmounts = getExistingInvoiceAmounts(item.id);
    const validation = validateItemForLinking(item, existingAmounts);
    
    if (!validation.valid) {
      errors.push({
        orderItemId: item.id,
        reason: validation.error || 'Invalid item',
      });
    }
  }

  return errors;
}

/**
 * Calculate total invoice amount from linked items' THIS BILL values
 */
export function calculateInvoiceAmountFromItems(
  items: OrderItemForValidation[]
): number {
  return items.reduce((total, item) => {
    const thisBill = calculateThisBill(item);
    return total + thisBill;
  }, 0);
}

/**
 * Create linked line items array from order item IDs with amounts
 * @param itemsWithAmounts Array of { itemId, amount } pairs
 */
export function createLinkedLineItemsFromAmounts(
  itemsWithAmounts: Array<{ itemId: string; amount: number }>
): LinkedLineItem[] {
  return itemsWithAmounts
    .filter(item => item.amount > 0)
    .map(item => ({
      orderItemId: item.itemId,
      thisBillAmount: item.amount,
    }));
}

/**
 * Create linked line items array from order item IDs (backward compatibility)
 * @deprecated Use createLinkedLineItemsFromAmounts for new code
 */
export function createLinkedLineItems(
  orderItemIds: string[],
  items: OrderItemForValidation[]
): LinkedLineItem[] {
  const itemMap = new Map(items.map(item => [item.id, item]));
  
  return orderItemIds
    .map(id => {
      const item = itemMap.get(id);
      if (!item) return null;
      return {
        orderItemId: id,
        thisBillAmount: calculateThisBill(item),
      };
    })
    .filter((item): item is LinkedLineItem => item !== null);
}
