import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dbxCustomerId = searchParams.get('dbxCustomerId');

    if (!dbxCustomerId) {
      return NextResponse.json(
        { error: 'dbxCustomerId is required' },
        { status: 400 }
      );
    }

    const customer = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.dbxCustomerId, dbxCustomerId))
      .limit(1);

    return NextResponse.json({
      exists: customer.length > 0,
    });
  } catch (error) {
    console.error('[Check Customer Exists] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check customer existence' },
      { status: 500 }
    );
  }
}
