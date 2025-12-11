import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { isTableNotExistError } from '@/lib/db/errorHelpers';

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
    const customerRows = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.dbxCustomerId, customerId))
      .limit(1);
    const customer = customerRows[0];

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Check if acknowledgment already exists and create/update
    try {
      const existingAcknowledgmentRows = await db
        .select()
        .from(schema.alertAcknowledgments)
        .where(and(
        eq(schema.alertAcknowledgments.customerId, customerId),
        eq(schema.alertAcknowledgments.alertType, alertType)
        ))
        .limit(1);
      const existingAcknowledgment = existingAcknowledgmentRows[0] || null;

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
      if (isTableNotExistError(error)) {
        console.warn(`[Acknowledge] alert_acknowledgments table does not exist, skipping acknowledgment for customer ${customerId}, alertType ${alertType}`);
        return NextResponse.json({
          success: true,
          message: 'Alert acknowledged (table not available, change will not persist)',
          warning: 'alert_acknowledgments table not found in database'
        });
      }
      throw error;
    }
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

