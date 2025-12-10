import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { logCustomerRestore } from '@/lib/services/changeHistory';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;
    console.log(`[POST /api/customers/${customerId}/recover] Recovering customer from trash...`);

    // Check if customer exists
    const customer = await db.query.customers.findFirst({
      where: eq(schema.customers.dbxCustomerId, customerId),
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Check if customer is actually deleted
    if (!customer.deletedAt) {
      return NextResponse.json(
        { error: 'Customer is not in trash' },
        { status: 400 }
      );
    }

    // Log customer restoration before restoring
    await logCustomerRestore(customerId, customer.clientName || 'Unknown Customer');

    // Recover: clear deletedAt timestamp
    await db.update(schema.customers)
      .set({ 
        deletedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.customers.dbxCustomerId, customerId));

    console.log(`[POST /api/customers/${customerId}/recover] Customer recovered successfully`);
    return NextResponse.json({ 
      success: true, 
      message: 'Customer recovered from trash successfully'
    });
  } catch (error) {
    console.error('Error recovering customer:', error);
    return NextResponse.json(
      {
        error: 'Failed to recover customer',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

