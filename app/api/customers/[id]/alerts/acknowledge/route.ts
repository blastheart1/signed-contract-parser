import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getSession();
    
    if (!session || !session.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const customerId = params.id;
    const body = await request.json();
    const { alertType } = body;

    if (!alertType) {
      return NextResponse.json(
        { success: false, error: 'alertType is required' },
        { status: 400 }
      );
    }

    // Verify customer exists
    const customer = await db.query.customers.findFirst({
      where: eq(schema.customers.dbxCustomerId, customerId),
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Check if acknowledgment already exists
    const existingAcknowledgment = await db.query.alertAcknowledgments.findFirst({
      where: and(
        eq(schema.alertAcknowledgments.customerId, customerId),
        eq(schema.alertAcknowledgments.alertType, alertType)
      ),
    });

    if (existingAcknowledgment) {
      // Update existing acknowledgment
      await db
        .update(schema.alertAcknowledgments)
        .set({
          acknowledgedBy: session.id,
          acknowledgedAt: new Date(),
        })
        .where(eq(schema.alertAcknowledgments.id, existingAcknowledgment.id));
    } else {
      // Create new acknowledgment
      await db.insert(schema.alertAcknowledgments).values({
        customerId,
        alertType,
        acknowledgedBy: session.id,
        acknowledgedAt: new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Alert acknowledged successfully',
    });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to acknowledge alert',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

