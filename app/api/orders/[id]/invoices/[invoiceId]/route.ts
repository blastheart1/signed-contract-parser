import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invoices, orders, orderItems } from '@/lib/db/schema';
import { eq, and, or, isNull } from 'drizzle-orm';
import { recalculateCustomerStatusForOrder } from '@/lib/services/customerStatus';
import { logInvoiceChange, valueToString } from '@/lib/services/changeHistory';
import {
  validateItemsForLinking,
  calculateInvoiceAmountFromItems,
  createLinkedLineItems,
  type OrderItemForValidation,
} from '@/lib/utils/invoiceLineItemValidation';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; invoiceId: string } }
) {
  try {
    const { id: orderId, invoiceId } = params;

    const invoiceRows = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);
    const invoice = invoiceRows[0];

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found', id: invoiceId },
        { status: 404 }
      );
    }

    // Verify invoice belongs to this order
    if (invoice.orderId !== orderId) {
      return NextResponse.json(
        { error: 'Invoice does not belong to this order' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, invoice });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch invoice',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; invoiceId: string } }
) {
  try {
    const { id: orderId, invoiceId } = params;
    const body = await request.json();
    
    console.log(`[PATCH /api/orders/${orderId}/invoices/${invoiceId}] Request body:`, {
      invoiceNumber: body.invoiceNumber,
      invoiceDate: body.invoiceDate,
      invoiceAmount: body.invoiceAmount,
      paymentsReceived: body.paymentsReceived,
      exclude: body.exclude,
      linkedLineItemIds: body.linkedLineItemIds,
      linkedLineItemIdsLength: body.linkedLineItemIds?.length || 0,
    });

    // Validate request body
    if (body.linkedLineItemIds !== undefined && !Array.isArray(body.linkedLineItemIds)) {
      console.error(`[PATCH /api/orders/${orderId}/invoices/${invoiceId}] Invalid linkedLineItemIds format:`, typeof body.linkedLineItemIds, body.linkedLineItemIds);
      return NextResponse.json(
        {
          error: 'Invalid request format',
          message: 'linkedLineItemIds must be an array',
        },
        { status: 400 }
      );
    }

    // Validate invoiceAmount if provided
    if (body.invoiceAmount !== undefined && body.invoiceAmount !== null && body.invoiceAmount !== '') {
      const amount = parseFloat(String(body.invoiceAmount));
      if (isNaN(amount) || amount < 0) {
        console.error(`[PATCH /api/orders/${orderId}/invoices/${invoiceId}] Invalid invoiceAmount:`, body.invoiceAmount);
        return NextResponse.json(
          {
            error: 'Invalid invoice amount',
            message: 'invoiceAmount must be a valid positive number',
          },
          { status: 400 }
        );
      }
    }

    // Verify invoice exists and belongs to order
    const invoiceRows = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);
    const invoice = invoiceRows[0];

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found', id: invoiceId },
        { status: 404 }
      );
    }

    if (invoice.orderId !== orderId) {
      return NextResponse.json(
        { error: 'Invoice does not belong to this order' },
        { status: 400 }
      );
    }

    // Get order for customerId
    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    const order = orderRows[0] || null;

    // Handle line item linking if provided
    let linkedLineItems = undefined;
    let calculatedInvoiceAmount = body.invoiceAmount;

    if (body.linkedLineItemIds !== undefined) {
      if (Array.isArray(body.linkedLineItemIds)) {
        if (body.linkedLineItemIds.length > 0) {
          console.log(`[PATCH /api/orders/${orderId}/invoices/${invoiceId}] Processing ${body.linkedLineItemIds.length} linked line items`);
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
        
        console.log(`[PATCH /api/orders/${orderId}/invoices/${invoiceId}] Selected items for validation:`, selectedItems.map(item => ({
          id: item.id,
          thisBill_raw: item.thisBill,
          progressOverallPct: item.progressOverallPct,
          previouslyInvoicedPct: item.previouslyInvoicedPct,
          amount: item.amount,
        })));

        if (selectedItems.length === 0) {
          console.error(`[PATCH /api/orders/${orderId}/invoices/${invoiceId}] No valid order items found for linking. Requested IDs:`, body.linkedLineItemIds);
          return NextResponse.json(
            { 
              error: 'No valid order items found for linking',
              message: `None of the provided ${body.linkedLineItemIds.length} item ID(s) were found or are valid for linking`,
            },
            { status: 400 }
          );
        }

        // Get existing invoice amounts for each item (excluding current invoice)
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
          console.error(`[PATCH /api/orders/${orderId}/invoices/${invoiceId}] Error fetching invoices (migration may be needed):`, invoiceError);
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
        for (const inv of allInvoices) {
          // Skip current invoice when calculating existing amounts
          if (inv.id === invoiceId) continue;

          if (inv.linkedLineItems && typeof inv.linkedLineItems === 'object') {
            const linkedItems = Array.isArray(inv.linkedLineItems)
              ? inv.linkedLineItems
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
          console.error(`[PATCH /api/orders/${orderId}/invoices/${invoiceId}] Validation failed:`, validationErrors);
          return NextResponse.json(
            {
              error: 'Validation failed',
              validationErrors: validationErrors,
              message: `Validation failed for ${validationErrors.length} item(s)`,
            },
            { status: 400 }
          );
        }
        
        console.log(`[PATCH /api/orders/${orderId}/invoices/${invoiceId}] Validation passed, calculating invoice amount`);

        // Calculate invoice amount from THIS BILL values
        calculatedInvoiceAmount = calculateInvoiceAmountFromItems(selectedItems).toString();
        console.log(`[PATCH /api/orders/${orderId}/invoices/${invoiceId}] Calculated invoice amount: ${calculatedInvoiceAmount}`);

        // Create linked line items array
        linkedLineItems = createLinkedLineItems(body.linkedLineItemIds, selectedItems);
        console.log(`[PATCH /api/orders/${orderId}/invoices/${invoiceId}] Created ${linkedLineItems.length} linked line items`);
        } else {
          // Empty array means remove all linked items
          console.log(`[PATCH /api/orders/${orderId}/invoices/${invoiceId}] Empty linkedLineItemIds array - clearing linked items`);
          linkedLineItems = null;
        }
      } else {
        console.error(`[PATCH /api/orders/${orderId}/invoices/${invoiceId}] linkedLineItemIds is not an array:`, typeof body.linkedLineItemIds, body.linkedLineItemIds);
        return NextResponse.json(
          {
            error: 'Invalid linkedLineItemIds format',
            message: 'linkedLineItemIds must be an array',
          },
          { status: 400 }
        );
      }
    } else {
      console.log(`[PATCH /api/orders/${orderId}/invoices/${invoiceId}] No linkedLineItemIds provided - not modifying linked items`);
    }

    // Update invoice
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (body.invoiceNumber !== undefined) updateData.invoiceNumber = body.invoiceNumber;
    if (body.invoiceDate !== undefined) updateData.invoiceDate = body.invoiceDate ? new Date(body.invoiceDate) : null;
    if (body.invoiceAmount !== undefined) {
      // If linked items are provided, use calculated amount; otherwise use provided amount
      updateData.invoiceAmount = calculatedInvoiceAmount !== undefined ? calculatedInvoiceAmount : body.invoiceAmount;
    }
    if (body.paymentsReceived !== undefined) updateData.paymentsReceived = body.paymentsReceived;
    if (body.exclude !== undefined) updateData.exclude = body.exclude;
    if (body.rowIndex !== undefined) updateData.rowIndex = body.rowIndex;
    if (linkedLineItems !== undefined) {
      updateData.linkedLineItems = linkedLineItems ? JSON.stringify(linkedLineItems) : null;
    }
    
    console.log(`[PATCH /api/orders/${orderId}/invoices/${invoiceId}] Updating invoice with:`, {
      ...updateData,
      linkedLineItems: linkedLineItems !== undefined ? (linkedLineItems ? `${Array.isArray(linkedLineItems) ? linkedLineItems.length : 'N/A'} items` : 'null') : 'not modified',
    });

    // Log field changes
    if (order) {
      const fieldsToCompare = [
        { name: 'invoiceNumber', old: invoice.invoiceNumber, new: body.invoiceNumber },
        { name: 'invoiceDate', old: invoice.invoiceDate, new: body.invoiceDate },
        { name: 'invoiceAmount', old: invoice.invoiceAmount, new: body.invoiceAmount },
        { name: 'paymentsReceived', old: invoice.paymentsReceived, new: body.paymentsReceived },
        { name: 'exclude', old: invoice.exclude, new: body.exclude },
      ];

      for (const field of fieldsToCompare) {
        if (field.new !== undefined) {
          const oldStr = valueToString(field.old);
          const newStr = valueToString(field.new);
          if (oldStr !== newStr) {
            await logInvoiceChange(
              'row_update',
              field.name,
              oldStr,
              newStr,
              orderId,
              order.customerId
            );
          }
        }
      }
    }

    const updatedInvoice = await db.update(invoices)
      .set(updateData)
      .where(eq(invoices.id, invoiceId))
      .returning();

    console.log(`[PATCH /api/orders/${orderId}/invoices/${invoiceId}] Invoice updated successfully`);

    // Trigger customer status recalculation
    await recalculateCustomerStatusForOrder(orderId);

    return NextResponse.json({ success: true, invoice: updatedInvoice[0] });
  } catch (error) {
    console.error(`[PATCH /api/orders/${params.id}/invoices/${params.invoiceId}] Error updating invoice:`, error);
    console.error(`[PATCH /api/orders/${params.id}/invoices/${params.invoiceId}] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      {
        error: 'Failed to update invoice',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; invoiceId: string } }
) {
  try {
    const { id: orderId, invoiceId } = params;

    // Verify invoice exists and belongs to order
    const invoiceRows = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);
    const invoice = invoiceRows[0];

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found', id: invoiceId },
        { status: 404 }
      );
    }

    if (invoice.orderId !== orderId) {
      return NextResponse.json(
        { error: 'Invoice does not belong to this order' },
        { status: 400 }
      );
    }

    // Get order for customerId
    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    const order = orderRows[0] || null;

    // Log invoice deletion
    if (order) {
      await logInvoiceChange(
        'row_delete',
        'invoice',
        `Invoice ${invoice.invoiceNumber || invoice.id}`,
        null,
        orderId,
        order.customerId
      );
    }

    // Delete invoice
    await db.delete(invoices).where(eq(invoices.id, invoiceId));

    // Trigger customer status recalculation
    await recalculateCustomerStatusForOrder(orderId);

    return NextResponse.json({ success: true, message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete invoice',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

