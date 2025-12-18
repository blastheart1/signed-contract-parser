import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invoices, orders, orderItems } from '@/lib/db/schema';
import { eq, and, or, isNull } from 'drizzle-orm';
import { recalculateCustomerStatusForOrder } from '@/lib/services/customerStatus';
import { logInvoiceChange, valueToString } from '@/lib/services/changeHistory';
import {
  validateItemsForLinking,
  validateItemForLinkingWithAmount,
  calculateInvoiceAmountFromItems,
  createLinkedLineItems,
  createLinkedLineItemsFromAmounts,
  type OrderItemForValidation,
} from '@/lib/utils/invoiceLineItemValidation';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;

    // Verify order exists
    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    const order = orderRows[0];

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found', id: orderId },
        { status: 404 }
      );
    }

    // Get all invoices for this order, sorted by row_index
    const invoiceList = await db
      .select()
      .from(invoices)
      .where(eq(invoices.orderId, orderId))
      .orderBy(invoices.rowIndex);

    return NextResponse.json({ success: true, invoices: invoiceList });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch invoices',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    const body = await request.json();
    const skipChangeHistory = body.skipChangeHistory === true;
    
    console.log(`[POST /api/orders/${orderId}/invoices] Request body:`, {
      invoiceNumber: body.invoiceNumber,
      invoiceDate: body.invoiceDate,
      invoiceAmount: body.invoiceAmount,
      paymentsReceived: body.paymentsReceived,
      exclude: body.exclude,
      linkedLineItemIds: body.linkedLineItemIds,
      linkedLineItems: body.linkedLineItems,
      linkedLineItemIdsLength: body.linkedLineItemIds?.length || 0,
      linkedLineItemsLength: body.linkedLineItems?.length || 0,
    });

    // Validate request body - support both old format (linkedLineItemIds) and new format (linkedLineItems with amounts)
    if (body.linkedLineItemIds !== undefined && !Array.isArray(body.linkedLineItemIds)) {
      console.error(`[POST /api/orders/${orderId}/invoices] Invalid linkedLineItemIds format:`, typeof body.linkedLineItemIds, body.linkedLineItemIds);
      return NextResponse.json(
        {
          error: 'Invalid request format',
          message: 'linkedLineItemIds must be an array',
        },
        { status: 400 }
      );
    }

    if (body.linkedLineItems !== undefined && !Array.isArray(body.linkedLineItems)) {
      console.error(`[POST /api/orders/${orderId}/invoices] Invalid linkedLineItems format:`, typeof body.linkedLineItems, body.linkedLineItems);
      return NextResponse.json(
        {
          error: 'Invalid request format',
          message: 'linkedLineItems must be an array',
        },
        { status: 400 }
      );
    }

    // Validate invoiceAmount if provided
    if (body.invoiceAmount !== undefined && body.invoiceAmount !== null && body.invoiceAmount !== '') {
      const amount = parseFloat(String(body.invoiceAmount));
      if (isNaN(amount) || amount < 0) {
        console.error(`[POST /api/orders/${orderId}/invoices] Invalid invoiceAmount:`, body.invoiceAmount);
        return NextResponse.json(
          {
            error: 'Invalid invoice amount',
            message: 'invoiceAmount must be a valid positive number',
          },
          { status: 400 }
        );
      }
    }

    // Verify order exists
    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    const order = orderRows[0];

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found', id: orderId },
        { status: 404 }
      );
    }

    // Get current max row_index to determine next position
    const existingInvoices = await db
      .select()
      .from(invoices)
      .where(eq(invoices.orderId, orderId))
      .orderBy(invoices.rowIndex);

    // Calculate next row_index (start at 354, increment by 1)
    const nextRowIndex = existingInvoices.length > 0
      ? (existingInvoices[existingInvoices.length - 1].rowIndex || 354) + 1
      : 354;

    // Ensure we don't exceed row 391
    if (nextRowIndex > 391) {
      return NextResponse.json(
        { error: 'Maximum number of invoices reached (38 invoices)' },
        { status: 400 }
      );
    }

    // Handle line item linking if provided
    // Support both formats: new format (linkedLineItems with amounts) and old format (linkedLineItemIds)
    let linkedLineItems = null;
    let calculatedInvoiceAmount = body.invoiceAmount;

    // New format: linkedLineItems with amounts [{ itemId, amount }, ...]
    if (body.linkedLineItems !== undefined && Array.isArray(body.linkedLineItems) && body.linkedLineItems.length > 0) {
      console.log(`[POST /api/orders/${orderId}/invoices] Processing ${body.linkedLineItems.length} linked line items (new format with amounts)`);
      
      // Fetch the order items to validate
      const itemsToLink = await db
        .select()
        .from(orderItems)
        .where(
          and(
            eq(orderItems.orderId, orderId),
            eq(orderItems.itemType, 'item')
          )
        );

      const itemMap = new Map(itemsToLink.map(item => [item.id, item]));
      
      // Get existing invoice amounts for each item
      let allInvoices = [];
      try {
        allInvoices = await db
          .select()
          .from(invoices)
          .where(
            and(
              eq(invoices.orderId, orderId),
              or(isNull(invoices.exclude), eq(invoices.exclude, false))
            )
          );
      } catch (invoiceError) {
        console.error(`[POST /api/orders/${orderId}/invoices] Error fetching invoices (migration may be needed):`, invoiceError);
        return NextResponse.json(
          {
            error: 'Database migration required',
            message: 'Please run "npm run migrate" to add the linked_line_items column to the invoices table',
            details: invoiceError instanceof Error ? invoiceError.message : 'Unknown error'
          },
          { status: 500 }
        );
      }

      const itemInvoiceAmounts = new Map<string, number>();
      for (const invoice of allInvoices) {
        if (invoice.linkedLineItems && typeof invoice.linkedLineItems === 'object') {
          const linkedItems = Array.isArray(invoice.linkedLineItems)
            ? invoice.linkedLineItems
            : [];
          
          for (const linkedItem of linkedItems) {
            if (linkedItem && typeof linkedItem === 'object' && 'orderItemId' in linkedItem) {
              const itemId = String(linkedItem.orderItemId);
              const thisBillAmount = parseFloat(String(linkedItem.thisBillAmount || 0));
              const current = itemInvoiceAmounts.get(itemId) || 0;
              itemInvoiceAmounts.set(itemId, current + thisBillAmount);
            }
          }
        }
      }

      // Validate each item with its amount
      const validationErrors: Array<{ orderItemId: string; reason: string }> = [];
      const validItems: Array<{ itemId: string; amount: number }> = [];

      for (const linkedItem of body.linkedLineItems) {
        if (!linkedItem || typeof linkedItem !== 'object' || !linkedItem.itemId) {
          validationErrors.push({
            orderItemId: 'unknown',
            reason: 'Invalid item format. Expected { itemId, amount }',
          });
          continue;
        }

        const itemId = String(linkedItem.itemId);
        const invoiceAmount = parseFloat(String(linkedItem.amount || 0));
        const dbItem = itemMap.get(itemId);

        if (!dbItem) {
          validationErrors.push({
            orderItemId: itemId,
            reason: 'Item not found',
          });
          continue;
        }

        const existingAmounts = itemInvoiceAmounts.get(itemId) || 0;
        const validation = validateItemForLinkingWithAmount(
          {
            id: dbItem.id,
            amount: dbItem.amount,
            thisBill: null,
            progressOverallPct: dbItem.progressOverallPct,
            previouslyInvoicedPct: dbItem.previouslyInvoicedPct,
          },
          invoiceAmount,
          existingAmounts
        );

        if (!validation.valid) {
          validationErrors.push({
            orderItemId: itemId,
            reason: validation.error || 'Validation failed',
          });
        } else {
          validItems.push({ itemId, amount: invoiceAmount });
        }
      }

      if (validationErrors.length > 0) {
        console.error(`[POST /api/orders/${orderId}/invoices] Validation failed:`, validationErrors);
        return NextResponse.json(
          {
            error: 'Validation failed',
            validationErrors: validationErrors,
            message: `Validation failed for ${validationErrors.length} item(s)`,
          },
          { status: 400 }
        );
      }

      // Create linked line items array
      linkedLineItems = createLinkedLineItemsFromAmounts(validItems);
      calculatedInvoiceAmount = validItems.reduce((sum, item) => sum + item.amount, 0).toString();
      console.log(`[POST /api/orders/${orderId}/invoices] Created ${linkedLineItems.length} linked line items with total amount: ${calculatedInvoiceAmount}`);
    }
    // Old format: linkedLineItemIds (backward compatibility)
    else if (body.linkedLineItemIds !== undefined && Array.isArray(body.linkedLineItemIds)) {
      if (body.linkedLineItemIds.length > 0) {
        console.log(`[POST /api/orders/${orderId}/invoices] Processing ${body.linkedLineItemIds.length} linked line items (old format)`);
      // Fetch the order items to validate and calculate amounts
      const itemsToLink = await db
        .select()
        .from(orderItems)
        .where(
          and(
            eq(orderItems.orderId, orderId),
            eq(orderItems.itemType, 'item')
          )
        );

      const itemMap = new Map(itemsToLink.map(item => [item.id, item]));
      const selectedItems: OrderItemForValidation[] = body.linkedLineItemIds
        .map((id: string): OrderItemForValidation | null => {
          const item = itemMap.get(id);
          if (!item) return null;
          // Include all fields needed for calculation (thisBill may be null/0, will be calculated)
          return {
            id: item.id,
            amount: item.amount,
            thisBill: item.thisBill, // May be null/0, will be calculated in validation
            progressOverallPct: item.progressOverallPct,
            previouslyInvoicedPct: item.previouslyInvoicedPct,
          };
        })
        .filter((item: OrderItemForValidation | null): item is OrderItemForValidation => item !== null);
      
      console.log(`[POST /api/orders/${orderId}/invoices] Selected items for validation:`, selectedItems.map(item => ({
        id: item.id,
        thisBill_raw: item.thisBill,
        progressOverallPct: item.progressOverallPct,
        previouslyInvoicedPct: item.previouslyInvoicedPct,
        amount: item.amount,
      })));

      if (selectedItems.length === 0) {
        console.error(`[POST /api/orders/${orderId}/invoices] No valid order items found for linking. Requested IDs:`, body.linkedLineItemIds);
        return NextResponse.json(
          { 
            error: 'No valid order items found for linking',
            message: `None of the provided ${body.linkedLineItemIds.length} item ID(s) were found or are valid for linking`,
            requestedIds: body.linkedLineItemIds,
          },
          { status: 400 }
        );
      }

      // Get existing invoice amounts for each item
      // Note: This will fail if migration hasn't been run (linked_line_items column missing)
      let allInvoices = [];
      try {
        allInvoices = await db
          .select()
          .from(invoices)
          .where(
            and(
              eq(invoices.orderId, orderId),
              or(isNull(invoices.exclude), eq(invoices.exclude, false))
            )
          );
      } catch (invoiceError) {
        console.error(`[POST /api/orders/${orderId}/invoices] Error fetching invoices (migration may be needed):`, invoiceError);
        return NextResponse.json(
          {
            error: 'Database migration required',
            message: 'Please run "npm run migrate" to add the linked_line_items column to the invoices table',
            details: invoiceError instanceof Error ? invoiceError.message : 'Unknown error'
          },
          { status: 500 }
        );
      }

      const itemInvoiceAmounts = new Map<string, number>();
      for (const invoice of allInvoices) {
        if (invoice.linkedLineItems && typeof invoice.linkedLineItems === 'object') {
          const linkedItems = Array.isArray(invoice.linkedLineItems)
            ? invoice.linkedLineItems
            : [];
          
          for (const linkedItem of linkedItems) {
            if (linkedItem && typeof linkedItem === 'object' && 'orderItemId' in linkedItem) {
              const itemId = String(linkedItem.orderItemId);
              const thisBillAmount = parseFloat(String(linkedItem.thisBillAmount || 0));
              const current = itemInvoiceAmounts.get(itemId) || 0;
              itemInvoiceAmounts.set(itemId, current + thisBillAmount);
            }
          }
        }
      }

      // Validate items
      const getExistingAmounts = (itemId: string) => itemInvoiceAmounts.get(itemId) || 0;
      const validationErrors = validateItemsForLinking(selectedItems, getExistingAmounts);

      if (validationErrors.length > 0) {
        console.error(`[POST /api/orders/${orderId}/invoices] Validation failed:`, validationErrors);
        return NextResponse.json(
          {
            error: 'Validation failed',
            validationErrors: validationErrors,
            message: `Validation failed for ${validationErrors.length} item(s)`,
          },
          { status: 400 }
        );
      }
      
      console.log(`[POST /api/orders/${orderId}/invoices] Validation passed, calculating invoice amount`);

      // Calculate invoice amount from THIS BILL values
      calculatedInvoiceAmount = calculateInvoiceAmountFromItems(selectedItems).toString();
      console.log(`[POST /api/orders/${orderId}/invoices] Calculated invoice amount: ${calculatedInvoiceAmount}`);

      // Create linked line items array
      linkedLineItems = createLinkedLineItems(body.linkedLineItemIds, selectedItems);
      console.log(`[POST /api/orders/${orderId}/invoices] Created ${linkedLineItems.length} linked line items`);
      } else {
        console.log(`[POST /api/orders/${orderId}/invoices] Empty linkedLineItemIds array - no items to link`);
      }
    } else {
      console.log(`[POST /api/orders/${orderId}/invoices] No linkedLineItemIds provided - creating invoice without linked items`);
    }

    // Create new invoice
    const invoiceValues = {
      orderId: orderId,
      invoiceNumber: body.invoiceNumber || null,
      invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : null,
      invoiceAmount: calculatedInvoiceAmount || null,
      paymentsReceived: body.paymentsReceived || '0',
      exclude: body.exclude || false,
      rowIndex: nextRowIndex,
      linkedLineItems: linkedLineItems ? JSON.stringify(linkedLineItems) : null,
    };
    
    console.log(`[POST /api/orders/${orderId}/invoices] Creating invoice with values:`, {
      ...invoiceValues,
      linkedLineItems: linkedLineItems ? `${linkedLineItems.length} items` : null,
    });
    
    const newInvoice = await db.insert(invoices).values(invoiceValues).returning();

    // Log invoice creation
    if (!skipChangeHistory) {
    await logInvoiceChange(
      'row_add',
      'invoice',
      null,
      `Invoice ${body.invoiceNumber || 'New'}`,
      orderId,
      order.customerId
    );
    }

    // Trigger customer status recalculation
    await recalculateCustomerStatusForOrder(orderId);

    console.log(`[POST /api/orders/${orderId}/invoices] Invoice created successfully:`, newInvoice[0].id);
    return NextResponse.json({ success: true, invoice: newInvoice[0] }, { status: 201 });
  } catch (error) {
    console.error(`[POST /api/orders/${params.id}/invoices] Error creating invoice:`, error);
    console.error(`[POST /api/orders/${params.id}/invoices] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      {
        error: 'Failed to create invoice',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

