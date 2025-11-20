import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderItems, changeHistory } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { recalculateCustomerStatusForOrder } from '@/lib/services/customerStatus';
import { logOrderItemChange, valueToString, valuesAreEqual } from '@/lib/services/changeHistory';
import type { OrderItem } from '@/lib/tableExtractor';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    console.log(`[PUT /api/orders/${orderId}/items] Starting order items update...`);
    
    const body = await request.json();
    const items: OrderItem[] = body.items || [];
    console.log(`[PUT /api/orders/${orderId}/items] Received ${items.length} items to update`);

    // Verify order exists
    console.log(`[PUT /api/orders/${orderId}/items] Verifying order exists...`);
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    if (!order) {
      console.error(`[PUT /api/orders/${orderId}/items] Order not found`);
      return NextResponse.json(
        { error: 'Order not found', id: orderId },
        { status: 404 }
      );
    }
    console.log(`[PUT /api/orders/${orderId}/items] Order found: ${order.orderNo}`);

    // Fetch existing order items for comparison
    const existingItems = await db.query.orderItems.findMany({
      where: eq(orderItems.orderId, orderId),
      orderBy: orderItems.rowIndex,
    });
    console.log(`[PUT /api/orders/${orderId}/items] Found ${existingItems.length} existing items`);

    // Before deleting order items, we need to clear the order_item_id references in change_history
    // to avoid foreign key constraint violations
    // We clear all references for this order since all items belong to this order
    console.log(`[PUT /api/orders/${orderId}/items] Clearing order_item_id references in change_history...`);
    await db
      .update(changeHistory)
      .set({ orderItemId: null })
      .where(eq(changeHistory.orderId, orderId));
    console.log(`[PUT /api/orders/${orderId}/items] Cleared order_item_id references`);

    // Delete existing order items
    console.log(`[PUT /api/orders/${orderId}/items] Deleting existing order items...`);
    const deleteResult = await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
    console.log(`[PUT /api/orders/${orderId}/items] Deleted existing order items`);

    // Insert new order items
    if (items && items.length > 0) {
      console.log(`[PUT /api/orders/${orderId}/items] Preparing ${items.length} items for insertion...`);
      const orderItemsToInsert = items.map((item: OrderItem, index: number) => {
        // Calculate completedAmount from progressOverallPct * amount if not explicitly set
        // Formula: completedAmount = (progressOverallPct / 100) * amount
        const amount = item.amount ? (typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount)) || 0) : 0;
        const progressOverallPct = item.progressOverallPct ? (typeof item.progressOverallPct === 'number' ? item.progressOverallPct : parseFloat(String(item.progressOverallPct)) || 0) : 0;
        
        let completedAmount: string | null = null;
        if (item.type === 'item' && progressOverallPct > 0 && amount > 0) {
          // Calculate: (percentage / 100) * amount
          const calculatedCompletedAmount = (progressOverallPct / 100) * amount;
          completedAmount = calculatedCompletedAmount.toString();
        } else if (item.completedAmount) {
          // Use explicit value if provided
          completedAmount = typeof item.completedAmount === 'number' ? item.completedAmount.toString() : item.completedAmount;
        }

        return {
          orderId: orderId,
          rowIndex: index,
          columnALabel: item.type === 'maincategory' ? '1 - Header' : 
                        item.type === 'subcategory' ? '1 - Subheader' : 
                        '1 - Detail',
          columnBLabel: 'Initial', // All email contracts are "Initial"
          productService: item.productService || '',
          qty: item.qty ? (typeof item.qty === 'number' ? item.qty.toString() : item.qty) : null,
          rate: item.rate ? (typeof item.rate === 'number' ? item.rate.toString() : item.rate) : null,
          amount: amount > 0 ? amount.toString() : null,
          progressOverallPct: progressOverallPct > 0 ? progressOverallPct.toString() : null,
          completedAmount,
          previouslyInvoicedPct: item.previouslyInvoicedPct ? (typeof item.previouslyInvoicedPct === 'number' ? item.previouslyInvoicedPct.toString() : item.previouslyInvoicedPct) : null,
          previouslyInvoicedAmount: item.previouslyInvoicedAmount ? (typeof item.previouslyInvoicedAmount === 'number' ? item.previouslyInvoicedAmount.toString() : item.previouslyInvoicedAmount) : null,
          newProgressPct: item.newProgressPct ? (typeof item.newProgressPct === 'number' ? item.newProgressPct.toString() : item.newProgressPct) : null,
          thisBill: item.thisBill ? (typeof item.thisBill === 'number' ? item.thisBill.toString() : item.thisBill) : null,
          itemType: item.type,
          mainCategory: item.mainCategory || null,
          subCategory: item.subCategory || null,
        };
      });

      console.log(`[PUT /api/orders/${orderId}/items] Inserting ${orderItemsToInsert.length} order items into database...`);
      const insertedItems = await db.insert(orderItems).values(orderItemsToInsert).returning();
      console.log(`[PUT /api/orders/${orderId}/items] Successfully inserted ${orderItemsToInsert.length} order items`);

      // Log changes: compare existing items with new items
      const customerId = order.customerId;
      
      // Create maps for easier comparison
      const existingMap = new Map(existingItems.map(item => [item.rowIndex, item]));
      const newMap = new Map(items.map((item, idx) => [idx, item]));

      // Log row deletions (items that existed but are now gone)
      for (const existingItem of existingItems) {
        if (!newMap.has(existingItem.rowIndex || -1)) {
          await logOrderItemChange(
            'row_delete',
            'row',
            existingItem.productService || 'Row',
            null,
            orderId,
            customerId,
            existingItem.id,
            existingItem.rowIndex || undefined
          );
        }
      }

      // Log row additions and edits
      for (let idx = 0; idx < items.length; idx++) {
        const newItem = items[idx];
        const existingItem = existingMap.get(idx);
        const insertedItem = insertedItems[idx];

        if (!existingItem) {
          // New row added
          await logOrderItemChange(
            'row_add',
            'row',
            null,
            newItem.productService || 'New Row',
            orderId,
            customerId,
            insertedItem?.id,
            idx
          );
        } else {
          // Compare fields for edits
          // Only log user-editable fields, skip computed fields like completedAmount
          const userEditableFields = [
            { name: 'productService', old: existingItem.productService, new: newItem.productService },
            { name: 'qty', old: existingItem.qty, new: newItem.qty ? (typeof newItem.qty === 'number' ? newItem.qty.toString() : newItem.qty) : null },
            { name: 'rate', old: existingItem.rate, new: newItem.rate ? (typeof newItem.rate === 'number' ? newItem.rate.toString() : newItem.rate) : null },
            { name: 'amount', old: existingItem.amount, new: newItem.amount ? (typeof newItem.amount === 'number' ? newItem.amount.toString() : newItem.amount) : null },
            { name: 'progressOverallPct', old: existingItem.progressOverallPct, new: newItem.progressOverallPct ? (typeof newItem.progressOverallPct === 'number' ? newItem.progressOverallPct.toString() : newItem.progressOverallPct) : null },
            { name: 'previouslyInvoicedPct', old: existingItem.previouslyInvoicedPct, new: newItem.previouslyInvoicedPct ? (typeof newItem.previouslyInvoicedPct === 'number' ? newItem.previouslyInvoicedPct.toString() : newItem.previouslyInvoicedPct) : null },
            { name: 'previouslyInvoicedAmount', old: existingItem.previouslyInvoicedAmount, new: newItem.previouslyInvoicedAmount ? (typeof newItem.previouslyInvoicedAmount === 'number' ? newItem.previouslyInvoicedAmount.toString() : newItem.previouslyInvoicedAmount) : null },
            { name: 'newProgressPct', old: existingItem.newProgressPct, new: newItem.newProgressPct ? (typeof newItem.newProgressPct === 'number' ? newItem.newProgressPct.toString() : newItem.newProgressPct) : null },
            { name: 'thisBill', old: existingItem.thisBill, new: newItem.thisBill ? (typeof newItem.thisBill === 'number' ? newItem.thisBill.toString() : newItem.thisBill) : null },
          ];

          // Collect all changed fields for this row (excluding computed fields like completedAmount)
          const changedFields = userEditableFields.filter(field => !valuesAreEqual(field.old, field.new));

          // If there are changes, log them as a single grouped entry
          if (changedFields.length > 0) {
            // If only one field changed, log it normally with old/new values
            if (changedFields.length === 1) {
              const field = changedFields[0];
              const oldStr = valueToString(field.old);
              const newStr = valueToString(field.new);
              await logOrderItemChange(
                'cell_edit',
                field.name,
                oldStr,
                newStr,
                orderId,
                customerId,
                insertedItem?.id,
                idx
              );
            } else {
              // Multiple fields changed in one action - log as a single "row_update" entry
              // Create a summary of all changes
              const changesSummary = changedFields.map(f => {
                const oldStr = valueToString(f.old);
                const newStr = valueToString(f.new);
                return `${f.name}: ${oldStr || '(empty)'} → ${newStr || '(empty)'}`;
              }).join('; ');
              
              await logOrderItemChange(
                'row_update',
                changedFields.map(f => f.name).join(', '),
                `Multiple fields: ${changesSummary}`,
                `Updated ${changedFields.length} fields`,
                orderId,
                customerId,
                insertedItem?.id,
                idx
              );
            }
          }
        }
      }
    } else {
      console.log(`[PUT /api/orders/${orderId}/items] No items to insert (empty array)`);
      
      // Log deletion of all items
      const customerId = order.customerId;
      for (const existingItem of existingItems) {
        await logOrderItemChange(
          'row_delete',
          'row',
          existingItem.productService || 'Row',
          null,
          orderId,
          customerId,
          existingItem.id,
          existingItem.rowIndex || undefined
        );
      }
    }

    // Update order's updatedAt timestamp
    console.log(`[PUT /api/orders/${orderId}/items] Updating order timestamp...`);
    await db.update(orders)
      .set({ updatedAt: new Date() })
      .where(eq(orders.id, orderId));
    console.log(`[PUT /api/orders/${orderId}/items] Order timestamp updated`);

    // Trigger customer status recalculation
    console.log(`[PUT /api/orders/${orderId}/items] Triggering customer status recalculation...`);
    await recalculateCustomerStatusForOrder(orderId);
    console.log(`[PUT /api/orders/${orderId}/items] Customer status recalculated`);

    console.log(`[PUT /api/orders/${orderId}/items] Successfully completed order items update`);
    return NextResponse.json({ success: true, message: 'Order items updated successfully' });
  } catch (error) {
    console.error(`[PUT /api/orders/${params.id}/items] Error updating order items:`, error);
    console.error(`[PUT /api/orders/${params.id}/items] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      {
        error: 'Failed to update order items',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

