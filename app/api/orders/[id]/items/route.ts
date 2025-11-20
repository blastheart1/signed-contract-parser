import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderItems } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { recalculateCustomerStatusForOrder } from '@/lib/services/customerStatus';
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
      await db.insert(orderItems).values(orderItemsToInsert);
      console.log(`[PUT /api/orders/${orderId}/items] Successfully inserted ${orderItemsToInsert.length} order items`);
    } else {
      console.log(`[PUT /api/orders/${orderId}/items] No items to insert (empty array)`);
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

