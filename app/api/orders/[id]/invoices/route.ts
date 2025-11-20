import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invoices, orders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { recalculateCustomerStatusForOrder } from '@/lib/services/customerStatus';
import { logInvoiceChange, valueToString } from '@/lib/services/changeHistory';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;

    // Verify order exists
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found', id: orderId },
        { status: 404 }
      );
    }

    // Get all invoices for this order, sorted by row_index
    const invoiceList = await db.query.invoices.findMany({
      where: eq(invoices.orderId, orderId),
      orderBy: invoices.rowIndex,
    });

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

    // Verify order exists
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found', id: orderId },
        { status: 404 }
      );
    }

    // Get current max row_index to determine next position
    const existingInvoices = await db.query.invoices.findMany({
      where: eq(invoices.orderId, orderId),
      orderBy: invoices.rowIndex,
    });

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

    // Create new invoice
    const newInvoice = await db.insert(invoices).values({
      orderId: orderId,
      invoiceNumber: body.invoiceNumber || null,
      invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : null,
      invoiceAmount: body.invoiceAmount || null,
      paymentsReceived: body.paymentsReceived || '0',
      exclude: body.exclude || false,
      rowIndex: nextRowIndex,
    }).returning();

    // Log invoice creation
    await logInvoiceChange(
      'row_add',
      'invoice',
      null,
      `Invoice ${body.invoiceNumber || 'New'}`,
      orderId,
      order.customerId
    );

    // Trigger customer status recalculation
    await recalculateCustomerStatusForOrder(orderId);

    return NextResponse.json({ success: true, invoice: newInvoice[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating invoice:', error);
    return NextResponse.json(
      {
        error: 'Failed to create invoice',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

