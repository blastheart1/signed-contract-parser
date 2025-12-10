import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { saveContractToDatabase, convertDatabaseToStoredContract } from '@/lib/db/contractHelpers';
import type { StoredContract } from '@/lib/store/contractStore';
import { eq } from 'drizzle-orm';
import { logContractAdd } from '@/lib/services/changeHistory';

export async function GET(request: NextRequest) {
  try {
    // Fetch all orders with their customers and items
    const orders = await db
      .select()
      .from(schema.orders)
      .orderBy(schema.orders.createdAt);

    const contracts: StoredContract[] = [];

    for (const order of orders) {
      // Get customer
      const [customer] = await db
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.dbxCustomerId, order.customerId))
        .limit(1);

      if (!customer) continue;

      // Get order items
      const orderItems = await db
        .select()
        .from(schema.orderItems)
        .where(eq(schema.orderItems.orderId, order.id));

      const contract = convertDatabaseToStoredContract(customer, order, orderItems);
      // Add deleted status to contract
      (contract as any).isDeleted = !!customer.deletedAt;
      (contract as any).deletedAt = customer.deletedAt;
      contracts.push(contract);
    }
    
    // Sort by latest to oldest (by createdAt/parsedAt)
    contracts.sort((a, b) => {
      const dateA = a.parsedAt ? new Date(a.parsedAt).getTime() : 0;
      const dateB = b.parsedAt ? new Date(b.parsedAt).getTime() : 0;
      return dateB - dateA; // Latest first
    });

    return NextResponse.json({ success: true, contracts });
  } catch (error) {
    console.error('Error fetching contracts:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch contracts',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const contract: StoredContract = body;
    
    // Validate contract data
    if (!contract.customer || !contract.order || !contract.items) {
      return NextResponse.json(
        { 
          error: 'Invalid contract data',
          message: 'Contract must have customer, order, and items'
        },
        { status: 400 }
      );
    }

    // Validate dbxCustomerId is present (required for primary key)
    if (!contract.customer.dbxCustomerId) {
      return NextResponse.json(
        { 
          error: 'Invalid contract data',
          message: 'dbxCustomerId is required'
        },
        { status: 400 }
      );
    }
    
    // Check if order already exists to determine if this is a new contract
    const existingOrder = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.orderNo, contract.order.orderNo))
      .limit(1)
      .then(rows => rows[0]);
    
    const isNewContract = !existingOrder;
    
    // Save to database
    await saveContractToDatabase(contract);
    
    // Fetch the saved contract to return
    const [order] = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.orderNo, contract.order.orderNo))
      .limit(1);

    if (!order) {
      throw new Error('Failed to retrieve saved order');
    }
    
    // Log contract addition if this is a new contract
    if (isNewContract) {
      const contractDescription = `Contract for ${contract.customer.clientName || 'Unknown'} - Order #${contract.order.orderNo}`;
      await logContractAdd(contract.customer.dbxCustomerId, order.id, contractDescription);
    }

    const [customer] = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.dbxCustomerId, contract.customer.dbxCustomerId))
      .limit(1);

    if (!customer) {
      throw new Error('Failed to retrieve saved customer');
    }

    const orderItems = await db
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, order.id));

    const savedContract = convertDatabaseToStoredContract(customer, order, orderItems);
    
    return NextResponse.json({ success: true, contract: savedContract });
  } catch (error) {
    console.error('Error storing contract:', error);
    return NextResponse.json(
      { 
        error: 'Failed to store contract',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

