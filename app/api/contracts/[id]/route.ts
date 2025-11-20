import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { convertDatabaseToStoredContract, saveContractToDatabase } from '@/lib/db/contractHelpers';
import { eq, or } from 'drizzle-orm';
import type { StoredContract } from '@/lib/store/contractStore';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`[GET /api/contracts/${params.id}] Starting contract lookup...`);
    
    // Try to find by order UUID first (if it's a UUID format)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);
    let order;
    let customer;

    if (isUUID) {
      console.log(`[GET /api/contracts/${params.id}] ID is UUID format, looking up by order ID...`);
      // Try to find by order UUID
      order = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, params.id))
        .limit(1)
        .then(rows => rows[0]);

      if (order) {
        console.log(`[GET /api/contracts/${params.id}] Found order: ${order.orderNo}`);
        // Get customer for this order
        customer = await db
          .select()
          .from(schema.customers)
          .where(eq(schema.customers.dbxCustomerId, order.customerId))
          .limit(1)
          .then(rows => rows[0]);
        
        if (customer) {
          console.log(`[GET /api/contracts/${params.id}] Found customer: ${customer.dbxCustomerId}`);
        } else {
          console.warn(`[GET /api/contracts/${params.id}] Order found but customer not found: ${order.customerId}`);
        }
      } else {
        console.log(`[GET /api/contracts/${params.id}] Order not found by UUID, trying other methods...`);
      }
    }

    // If not found by UUID, try to find by dbx_customer_id (most common case)
    if (!customer) {
      console.log(`[GET /api/contracts/${params.id}] Trying to find by dbx_customer_id...`);
      customer = await db
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.dbxCustomerId, params.id))
        .limit(1)
        .then(rows => rows[0]);

      if (customer) {
        console.log(`[GET /api/contracts/${params.id}] Found customer: ${customer.dbxCustomerId}`);
        // Found by customer ID, get the most recent order for this customer
        order = await db
          .select()
          .from(schema.orders)
          .where(eq(schema.orders.customerId, customer.dbxCustomerId))
          .orderBy(schema.orders.createdAt)
          .limit(1)
          .then(rows => rows[0]);
        
        if (order) {
          console.log(`[GET /api/contracts/${params.id}] Found most recent order: ${order.orderNo}`);
        }
      }
    }

    // If still not found, try to find by order number
    if (!order) {
      console.log(`[GET /api/contracts/${params.id}] Trying to find by order number...`);
      order = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.orderNo, params.id))
        .limit(1)
        .then(rows => rows[0]);

      if (order) {
        console.log(`[GET /api/contracts/${params.id}] Found order by order number: ${order.orderNo}`);
        // Get customer for this order
        customer = await db
          .select()
          .from(schema.customers)
          .where(eq(schema.customers.dbxCustomerId, order.customerId))
          .limit(1)
          .then(rows => rows[0]);
        
        if (customer) {
          console.log(`[GET /api/contracts/${params.id}] Found customer: ${customer.dbxCustomerId}`);
        }
      }
    }

    if (!customer || !order) {
      console.error(`[GET /api/contracts/${params.id}] Contract not found - customer: ${!!customer}, order: ${!!order}`);
      return NextResponse.json(
        { 
          error: 'Contract not found',
          message: 'Contract may be stored in localStorage. Please use the dashboard to generate the spreadsheet.',
          id: params.id
        },
        { status: 404 }
      );
    }

    // Get order items
    console.log(`[GET /api/contracts/${params.id}] Fetching order items for order ${order.id}...`);
    const orderItems = await db
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, order.id));

    console.log(`[GET /api/contracts/${params.id}] Found ${orderItems.length} order items`);
    const contract = convertDatabaseToStoredContract(customer, order, orderItems);
    
    console.log(`[GET /api/contracts/${params.id}] Successfully returning contract`);
    return NextResponse.json({ success: true, contract });
  } catch (error) {
    console.error('Error fetching contract:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch contract',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`[PUT /api/contracts/${params.id}] Updating contract...`);
    const body = await request.json();
    const contract: StoredContract = body;

    // Validate contract data
    if (!contract.id || !contract.customer || !contract.order || !contract.items) {
      return NextResponse.json(
        {
          error: 'Invalid contract data',
          message: 'Contract must have id, customer, order, and items'
        },
        { status: 400 }
      );
    }

    // Convert parsedAt to Date if it's a string
    if (typeof contract.parsedAt === 'string') {
      contract.parsedAt = new Date(contract.parsedAt);
    }

    const updatedContractId = await saveContractToDatabase(contract);
    console.log(`[PUT /api/contracts/${params.id}] Contract updated successfully: ${updatedContractId}`);

    return NextResponse.json({ success: true, contractId: updatedContractId });
  } catch (error) {
    console.error('Error updating contract:', error);
    return NextResponse.json(
      {
        error: 'Failed to update contract',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

