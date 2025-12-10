import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { saveContractToDatabase, convertDatabaseToStoredContract } from '@/lib/db/contractHelpers';
import type { StoredContract } from '@/lib/store/contractStore';
import { eq, inArray, desc } from 'drizzle-orm';
import { logContractAdd } from '@/lib/services/changeHistory';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '1000', 10); // Default high limit for backward compatibility

    // Fetch all orders with their customers and items (sorted by createdAt descending)
    const allOrders = await db
      .select()
      .from(schema.orders)
      .orderBy(desc(schema.orders.createdAt));

    const totalOrders = allOrders.length;

    // Apply pagination
    const offset = (page - 1) * limit;
    const orders = allOrders.slice(offset, offset + limit);

    if (orders.length === 0) {
      return NextResponse.json({ 
        success: true, 
        contracts: [],
        pagination: {
          page,
          limit,
          total: totalOrders,
          totalPages: Math.ceil(totalOrders / limit)
        }
      });
    }

    // Get all unique customer IDs and order IDs for batch fetching
    const customerIds = [...new Set(orders.map(o => o.customerId))];
    const orderIds = orders.map(o => o.id);

    // Batch fetch all customers in one query
    const allCustomers = customerIds.length > 0
      ? await db
          .select()
          .from(schema.customers)
          .where(inArray(schema.customers.dbxCustomerId, customerIds))
      : [];

    // Create a map for quick customer lookup
    const customersMap = new Map<string, typeof schema.customers.$inferSelect>();
    for (const customer of allCustomers) {
      customersMap.set(customer.dbxCustomerId, customer);
    }

    // Batch fetch all order items in one query
    const allOrderItems = orderIds.length > 0
      ? await db
          .select()
          .from(schema.orderItems)
          .where(inArray(schema.orderItems.orderId, orderIds))
      : [];

    // Group order items by order ID
    const orderItemsByOrder = new Map<string, typeof schema.orderItems.$inferSelect[]>();
    for (const item of allOrderItems) {
      const existing = orderItemsByOrder.get(item.orderId) || [];
      existing.push(item);
      orderItemsByOrder.set(item.orderId, existing);
    }

    // Build contracts array
    const contracts: StoredContract[] = [];

    for (const order of orders) {
      const customer = customersMap.get(order.customerId);
      
      if (!customer) continue;

      // Get order items from the pre-fetched map
      const orderItems = orderItemsByOrder.get(order.id) || [];

      const contract = convertDatabaseToStoredContract(customer, order, orderItems);
      // Add deleted status to contract
      (contract as any).isDeleted = !!customer.deletedAt;
      (contract as any).deletedAt = customer.deletedAt;
      contracts.push(contract);
    }
    
    // Sort by latest to oldest (by createdAt/parsedAt) - already sorted by createdAt, but parsedAt might differ
    contracts.sort((a, b) => {
      const dateA = a.parsedAt ? new Date(a.parsedAt).getTime() : 0;
      const dateB = b.parsedAt ? new Date(b.parsedAt).getTime() : 0;
      return dateB - dateA; // Latest first
    });

    return NextResponse.json({ 
      success: true, 
      contracts,
      pagination: {
        page,
        limit,
        total: totalOrders,
        totalPages: Math.ceil(totalOrders / limit)
      }
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
      }
    });
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

