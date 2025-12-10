import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { logCustomerDelete } from '@/lib/services/changeHistory';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;
    const customerRows = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.dbxCustomerId, customerId))
      .limit(1);
    const customer = customerRows[0];

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, customer });
  } catch (error) {
    console.error('Error fetching customer:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch customer',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;
    console.log(`[DELETE /api/customers/${customerId}] Soft deleting customer...`);

    // Check if customer exists
    const customerRows = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.dbxCustomerId, customerId))
      .limit(1);
    const customer = customerRows[0];

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Check if already deleted
    if (customer.deletedAt) {
      return NextResponse.json(
        { error: 'Customer is already deleted' },
        { status: 400 }
      );
    }

    // Log customer deletion before soft-deleting
    await logCustomerDelete(customerId, customer.clientName || 'Unknown Customer');

    // Soft delete: set deletedAt timestamp
    await db.update(schema.customers)
      .set({ 
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.customers.dbxCustomerId, customerId));

    // Get all orders for this customer to soft delete them too
    const orders = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.customerId, customerId));

    // Note: We don't have deletedAt on orders table yet, but we can add it if needed
    // For now, orders will remain but customer will be soft deleted
    // The customer's orders won't show up in normal queries since customer is deleted

    console.log(`[DELETE /api/customers/${customerId}] Customer soft deleted successfully`);
    return NextResponse.json({ 
      success: true, 
      message: 'Customer moved to trash. It will be permanently deleted after 30 days.',
      deletedAt: new Date()
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete customer',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

