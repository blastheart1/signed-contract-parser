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
      console.log(`[Alerts] Attempting to fetch acknowledgments for customer ${customerId}`);
      acknowledgments = await db
        .select()
        .from(schema.alertAcknowledgments)
        .where(eq(schema.alertAcknowledgments.customerId, customerId));
      console.log(`[Alerts] Successfully fetched ${acknowledgments.length} acknowledgments for customer ${customerId}`);
    } catch (error) {
      // Log the actual error for debugging - this will help us understand what's really happening
      console.error(`[Alerts] Error fetching acknowledgments for customer ${customerId}:`, error);
      if (error instanceof Error) {
        console.error(`[Alerts] Error name:`, error.name);
        console.error(`[Alerts] Error message:`, error.message);
        console.error(`[Alerts] Error stack:`, error.stack);
        if ('cause' in error && error.cause) {
          console.error(`[Alerts] Error cause:`, JSON.stringify(error.cause, Object.getOwnPropertyNames(error.cause), 2));
        }
        // Check all error properties
        console.error(`[Alerts] Error keys:`, Object.keys(error));
        if ('code' in error) {
          console.error(`[Alerts] Error code:`, (error as any).code);
        }
      } else {
        console.error(`[Alerts] Error is not an Error instance, type:`, typeof error);
        console.error(`[Alerts] Error value:`, JSON.stringify(error, null, 2));
      }
      
      // If table doesn't exist (error code 42P01), return empty array
      if (isTableNotExistError(error)) {
        console.warn(`[Alerts] alert_acknowledgments table does not exist (error code 42P01), returning empty acknowledgments for customer ${customerId}`);
        return NextResponse.json({
          success: true,
          acknowledgments: [],
        });
      }
      // Re-throw other errors - don't silently fail on unknown errors
      console.error(`[Alerts] Unexpected error type, re-throwing:`, error);
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

