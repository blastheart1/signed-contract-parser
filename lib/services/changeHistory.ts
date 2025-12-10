import { db, schema } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import type { NewChangeHistory } from '@/lib/db/schema';

/**
 * Get the current user ID from session, or return null if not logged in
 */
async function getCurrentUserId(): Promise<string | null> {
  try {
    const session = await getSession();
    return session?.id || null;
  } catch (error) {
    console.error('[changeHistory] Error getting session:', error);
    return null;
  }
}

/**
 * Generic function to log any change to the change history table
 */
export async function logChange(
  changeType: 'cell_edit' | 'row_add' | 'row_delete' | 'row_update' | 'customer_edit' | 'order_edit' | 'contract_add' | 'stage_update' | 'customer_delete' | 'customer_restore',
  fieldName: string,
  oldValue: string | null,
  newValue: string | null,
  options: {
    customerId?: string;
    orderId?: string;
    orderItemId?: string;
    rowIndex?: number;
  } = {}
): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    
    // Skip logging if user is not logged in
    if (!userId) {
      console.warn('[changeHistory] Skipping change log - user not logged in');
      return;
    }

    const changeData: NewChangeHistory = {
      changeType,
      fieldName,
      oldValue: oldValue || null,
      newValue: newValue || null,
      changedBy: userId,
      customerId: options.customerId || null,
      orderId: options.orderId || null,
      orderItemId: options.orderItemId || null,
      rowIndex: options.rowIndex || null,
    };

    await db.insert(schema.changeHistory).values(changeData);
    console.log(`[changeHistory] Logged ${changeType} for field ${fieldName}`);
  } catch (error) {
    console.error('[changeHistory] Error logging change:', error);
    // Don't throw - logging failures shouldn't break the main operation
  }
}

/**
 * Log order item changes (cell edits, row additions, deletions, updates)
 */
export async function logOrderItemChange(
  changeType: 'cell_edit' | 'row_add' | 'row_delete' | 'row_update',
  fieldName: string,
  oldValue: string | null,
  newValue: string | null,
  orderId: string,
  customerId: string,
  orderItemId?: string,
  rowIndex?: number
): Promise<void> {
  await logChange(changeType, fieldName, oldValue, newValue, {
    orderId,
    customerId,
    orderItemId,
    rowIndex,
  });
}

/**
 * Log customer information changes
 */
export async function logCustomerEdit(
  fieldName: string,
  oldValue: string | null,
  newValue: string | null,
  customerId: string
): Promise<void> {
  await logChange('customer_edit', fieldName, oldValue, newValue, {
    customerId,
  });
}

/**
 * Log order information changes
 */
export async function logOrderEdit(
  fieldName: string,
  oldValue: string | null,
  newValue: string | null,
  orderId: string,
  customerId: string
): Promise<void> {
  await logChange('order_edit', fieldName, oldValue, newValue, {
    orderId,
    customerId,
  });
}

/**
 * Log invoice changes (create, update, delete)
 */
export async function logInvoiceChange(
  changeType: 'row_add' | 'row_delete' | 'row_update',
  fieldName: string,
  oldValue: string | null,
  newValue: string | null,
  orderId: string,
  customerId: string
): Promise<void> {
  await logChange(changeType, fieldName, oldValue, newValue, {
    orderId,
    customerId,
  });
}

/**
 * Helper function to convert values to strings for comparison
 * Normalizes numeric values to prevent false positives
 */
export function valueToString(value: any): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  if (typeof value === 'number') {
    // Normalize numbers: remove trailing zeros for decimal comparison
    // But keep as string for exact comparison
    return value.toString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const str = String(value).trim();
  return str === '' ? null : str;
}

/**
 * Normalize numeric strings for comparison (handles "100.00" vs "100")
 */
export function normalizeNumericString(value: string | null): string | null {
  if (!value) return null;
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  // Return normalized number string (removes trailing zeros)
  return num.toString();
}

/**
 * Compare two values, handling numeric normalization
 */
export function valuesAreEqual(oldValue: any, newValue: any): boolean {
  const oldStr = valueToString(oldValue);
  const newStr = valueToString(newValue);
  
  // If both are null/empty, they're equal
  if (!oldStr && !newStr) return true;
  
  // If one is null and the other isn't, they're different
  if (!oldStr || !newStr) return false;
  
  // Try numeric comparison for numeric-looking strings
  const oldNum = parseFloat(oldStr);
  const newNum = parseFloat(newStr);
  
  // If both are valid numbers, compare numerically
  if (!isNaN(oldNum) && !isNaN(newNum)) {
    return Math.abs(oldNum - newNum) < 0.0001; // Small tolerance for floating point
  }
  
  // Otherwise, compare as strings
  return oldStr === newStr;
}

/**
 * Compare two values and log if they're different
 */
export async function logIfChanged(
  changeType: 'cell_edit' | 'row_add' | 'row_delete' | 'row_update' | 'customer_edit' | 'order_edit' | 'contract_add' | 'stage_update' | 'customer_delete' | 'customer_restore',
  fieldName: string,
  oldValue: any,
  newValue: any,
  options: {
    customerId?: string;
    orderId?: string;
    orderItemId?: string;
    rowIndex?: number;
  } = {}
): Promise<void> {
  const oldStr = valueToString(oldValue);
  const newStr = valueToString(newValue);
  
  // Only log if values are different
  if (oldStr !== newStr) {
    await logChange(changeType, fieldName, oldStr, newStr, options);
  }
}

/**
 * Log contract additions (when a new contract is uploaded/saved)
 */
export async function logContractAdd(
  customerId: string,
  orderId: string,
  contractDescription: string
): Promise<void> {
  await logChange('contract_add', 'contract', null, contractDescription, {
    customerId,
    orderId,
  });
}

/**
 * Log stage updates (when project stage changes)
 */
export async function logStageUpdate(
  oldStage: string | null,
  newStage: string | null,
  orderId: string,
  customerId: string
): Promise<void> {
  await logChange('stage_update', 'stage', valueToString(oldStage), valueToString(newStage), {
    orderId,
    customerId,
  });
}

/**
 * Log customer deletions (when customer is soft-deleted to trash)
 */
export async function logCustomerDelete(
  customerId: string,
  customerName: string
): Promise<void> {
  await logChange('customer_delete', 'customer', customerName, 'deleted', {
    customerId,
  });
}

/**
 * Log customer restoration (when customer is restored from trash)
 */
export async function logCustomerRestore(
  customerId: string,
  customerName: string
): Promise<void> {
  await logChange('customer_restore', 'customer', 'deleted', customerName, {
    customerId,
  });
}

