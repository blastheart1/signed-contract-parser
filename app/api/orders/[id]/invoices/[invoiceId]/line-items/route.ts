import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invoices, orders, orderItems } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

export async function GET(
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

    // Parse linked line items from JSONB
    let linkedItems: Array<{ orderItemId: string; thisBillAmount: number }> = [];
    if (invoice.linkedLineItems && typeof invoice.linkedLineItems === 'object') {
      if (Array.isArray(invoice.linkedLineItems)) {
        linkedItems = invoice.linkedLineItems as Array<{ orderItemId: string; thisBillAmount: number }>;
      }
    }

    if (linkedItems.length === 0) {
      return NextResponse.json({
        success: true,
        linkedItems: [],
        totalBilledAmount: 0,
      });
    }

    // Fetch full order item details
    const orderItemIds = linkedItems.map(item => item.orderItemId);
    const items = await db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.id, orderItemIds));

    const itemMap = new Map(items.map(item => [item.id, item]));

    // Combine linked item data with full item details
    const linkedItemsWithDetails = linkedItems
      .map(linkedItem => {
        const item = itemMap.get(linkedItem.orderItemId);
        if (!item) return null;

        return {
          orderItemId: linkedItem.orderItemId,
          thisBillAmount: parseFloat(String(linkedItem.thisBillAmount || 0)),
          productService: item.productService,
          amount: parseFloat(String(item.amount || 0)),
          qty: item.qty ? parseFloat(String(item.qty)) : null,
          rate: item.rate ? parseFloat(String(item.rate)) : null,
          progressOverallPct: item.progressOverallPct ? parseFloat(String(item.progressOverallPct)) : null,
          previouslyInvoicedPct: item.previouslyInvoicedPct ? parseFloat(String(item.previouslyInvoicedPct)) : null,
          currentThisBill: item.thisBill ? parseFloat(String(item.thisBill)) : null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    // Calculate total billed amount
    const totalBilledAmount = linkedItemsWithDetails.reduce(
      (sum, item) => sum + item.thisBillAmount,
      0
    );

    return NextResponse.json({
      success: true,
      linkedItems: linkedItemsWithDetails,
      totalBilledAmount,
    });
  } catch (error) {
    console.error('Error fetching invoice line items:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch invoice line items',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
