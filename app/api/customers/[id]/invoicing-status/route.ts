import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permissions - contract_manager, admin, and accountant can update
    if (session.role !== 'admin' && session.role !== 'contract_manager' && session.role !== 'accountant') {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    const customerId = params.id;
    const body = await request.json();
    const { status } = body;

    // Validate status value
    if (status !== 'pending_updates' && status !== 'completed') {
      return NextResponse.json(
        { error: 'Invalid status. Must be "pending_updates" or "completed"' },
        { status: 400 }
      );
    }

    // Update customer status
    const [updatedCustomer] = await db
      .update(schema.customers)
      .set({
        status: status as 'pending_updates' | 'completed',
        updatedAt: new Date(),
      })
      .where(eq(schema.customers.dbxCustomerId, customerId))
      .returning();

    if (!updatedCustomer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      customer: {
        id: updatedCustomer.dbxCustomerId,
        dbxCustomerId: updatedCustomer.dbxCustomerId,
        status: updatedCustomer.status,
      },
    });
  } catch (error) {
    console.error('Error updating invoicing status:', error);
    return NextResponse.json(
      {
        error: 'Failed to update invoicing status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

