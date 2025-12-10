import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { isTableNotExistError } from '@/lib/db/errorHelpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;

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

    // Fetch all acknowledgments for this customer
    let acknowledgments = [];
    try {
      acknowledgments = await db
        .select()
        .from(schema.alertAcknowledgments)
        .where(eq(schema.alertAcknowledgments.customerId, customerId));
    } catch (error) {
      // If table doesn't exist (error code 42P01), return empty array gracefully
      if (isTableNotExistError(error)) {
        console.warn(`[Alerts] alert_acknowledgments table does not exist, returning empty acknowledgments for customer ${customerId}`);
        return NextResponse.json({
          success: true,
          acknowledgments: [],
        });
      }
      // Re-throw other errors
      throw error;
    }

    // Fetch user details for each acknowledgment
    const acknowledgmentsWithUsers = await Promise.all(
      acknowledgments.map(async (ack) => {
        const userRows = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, ack.acknowledgedBy))
          .limit(1);
        const user = userRows[0] || null;

        return {
          alertType: ack.alertType,
          acknowledgedBy: {
            id: user?.id || null,
            username: user?.username || 'Unknown',
          },
          acknowledgedAt: ack.acknowledgedAt,
        };
      })
    );

    return NextResponse.json({
      success: true,
      acknowledgments: acknowledgmentsWithUsers,
    });
  } catch (error) {
    console.error('Error fetching alert acknowledgments:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch alert acknowledgments',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

