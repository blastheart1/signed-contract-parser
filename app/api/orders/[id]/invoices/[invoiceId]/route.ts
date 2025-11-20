import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invoices, orders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { recalculateCustomerStatusForOrder } from '@/lib/services/customerStatus';
import { logInvoiceChange, valueToString } from '@/lib/services/changeHistory';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; invoiceId: string } }
) {
  try {
    const { id: orderId, invoiceId } = params;

    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
    });

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

    // Verify invoice exists and belongs to order
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
    });

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
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    // Update invoice
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (body.invoiceNumber !== undefined) updateData.invoiceNumber = body.invoiceNumber;
    if (body.invoiceDate !== undefined) updateData.invoiceDate = body.invoiceDate ? new Date(body.invoiceDate) : null;
    if (body.invoiceAmount !== undefined) updateData.invoiceAmount = body.invoiceAmount;
    if (body.paymentsReceived !== undefined) updateData.paymentsReceived = body.paymentsReceived;
    if (body.exclude !== undefined) updateData.exclude = body.exclude;
    if (body.rowIndex !== undefined) updateData.rowIndex = body.rowIndex;

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

    // Trigger customer status recalculation
    await recalculateCustomerStatusForOrder(orderId);

    return NextResponse.json({ success: true, invoice: updatedInvoice[0] });
  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json(
      {
        error: 'Failed to update invoice',
        message: error instanceof Error ? error.message : 'Unknown error'
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
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
    });

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
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

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

