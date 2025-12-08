import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { convertDatabaseToStoredContract, saveContractToDatabase } from '@/lib/db/contractHelpers';
import { eq, or } from 'drizzle-orm';
import { logCustomerEdit, logOrderEdit, valueToString } from '@/lib/services/changeHistory';
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
    
    // Add deleted status to contract (same pattern as /api/contracts)
    (contract as any).isDeleted = !!customer.deletedAt;
    (contract as any).deletedAt = customer.deletedAt;
    
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

    // Fetch existing customer and order for comparison
    const customerId = contract.customer.dbxCustomerId;
    if (!customerId) {
      return NextResponse.json(
        {
          error: 'Invalid contract data',
          message: 'Contract customer must have dbxCustomerId'
        },
        { status: 400 }
      );
    }
    
    const existingCustomer = await db.query.customers.findFirst({
      where: eq(schema.customers.dbxCustomerId, customerId),
    });

    const existingOrder = await db.query.orders.findFirst({
      where: eq(schema.orders.orderNo, contract.order.orderNo),
    });

    // Save the contract
    const updatedContractId = await saveContractToDatabase(contract);
    console.log(`[PUT /api/contracts/${params.id}] Contract updated successfully: ${updatedContractId}`);

    // Log customer changes
    if (existingCustomer) {
      const customerFields = [
        { name: 'clientName', old: existingCustomer.clientName, new: contract.customer.clientName },
        { name: 'email', old: existingCustomer.email, new: contract.customer.email },
        { name: 'phone', old: existingCustomer.phone, new: contract.customer.phone },
        { name: 'streetAddress', old: existingCustomer.streetAddress, new: contract.customer.streetAddress },
        { name: 'city', old: existingCustomer.city, new: contract.customer.city },
        { name: 'state', old: existingCustomer.state, new: contract.customer.state },
        { name: 'zip', old: existingCustomer.zip, new: contract.customer.zip },
      ];

      for (const field of customerFields) {
        const oldStr = valueToString(field.old);
        const newStr = valueToString(field.new);
        if (oldStr !== newStr) {
          await logCustomerEdit(field.name, oldStr, newStr, customerId);
        }
      }
    }

    // Log order changes
    if (existingOrder) {
      const orderFields = [
        { name: 'orderDate', old: existingOrder.orderDate, new: contract.order.orderDate },
        { name: 'orderPO', old: existingOrder.orderPO, new: contract.order.orderPO },
        { name: 'orderDueDate', old: existingOrder.orderDueDate, new: contract.order.orderDueDate },
        { name: 'orderType', old: existingOrder.orderType, new: contract.order.orderType },
        { name: 'orderDelivered', old: existingOrder.orderDelivered, new: contract.order.orderDelivered },
        { name: 'quoteExpirationDate', old: existingOrder.quoteExpirationDate, new: contract.order.quoteExpirationDate },
        { name: 'orderGrandTotal', old: existingOrder.orderGrandTotal, new: contract.order.orderGrandTotal },
        { name: 'progressPayments', old: existingOrder.progressPayments, new: contract.order.progressPayments },
        { name: 'balanceDue', old: existingOrder.balanceDue, new: contract.order.balanceDue },
        { name: 'salesRep', old: existingOrder.salesRep, new: contract.order.salesRep },
      ];

      for (const field of orderFields) {
        const oldStr = valueToString(field.old);
        const newStr = valueToString(field.new);
        if (oldStr !== newStr) {
          await logOrderEdit(field.name, oldStr, newStr, existingOrder.id, customerId);
        }
      }
    }

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

