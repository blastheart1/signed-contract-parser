import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { convertDatabaseToStoredContract } from '@/lib/db/contractHelpers';
import { generateSpreadsheet } from '@/lib/spreadsheetGenerator';
import { generateSpreadsheetFilename } from '@/lib/filenameGenerator';
import { Location, OrderItem } from '@/lib/tableExtractor';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Try to get from database first
    let customer = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.dbxCustomerId, params.id))
      .limit(1)
      .then(rows => rows[0]);

    let order;

    if (customer) {
      // Found by customer ID, get the most recent order
      order = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.customerId, customer.dbxCustomerId))
        .orderBy(schema.orders.createdAt)
        .limit(1)
        .then(rows => rows[0]);
    } else {
      // Try to find by order number
      order = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.orderNo, params.id))
        .limit(1)
        .then(rows => rows[0]);

      if (order) {
        customer = await db
          .select()
          .from(schema.customers)
          .where(eq(schema.customers.dbxCustomerId, order.customerId))
          .limit(1)
          .then(rows => rows[0]);
      }
    }

    if (!customer || !order) {
      return NextResponse.json(
        { 
          error: 'Contract not found',
          message: 'Contract may be stored in localStorage. Please use POST method with contract data.',
          id: params.id
        },
        { status: 404 }
      );
    }

    // Get order items
    const orderItems = await db
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, order.id));

    const contract = convertDatabaseToStoredContract(customer, order, orderItems);
    
    // Convert stored contract to Location format
    const location: Location = {
      orderNo: contract.order.orderNo,
      streetAddress: contract.customer.streetAddress,
      city: contract.customer.city,
      state: contract.customer.state,
      zip: contract.customer.zip,
      clientName: contract.customer.clientName,
      dbxCustomerId: contract.customer.dbxCustomerId,
      email: contract.customer.email,
      phone: contract.customer.phone,
      orderDate: contract.order.orderDate,
      orderPO: contract.order.orderPO,
      orderDueDate: contract.order.orderDueDate,
      orderType: contract.order.orderType,
      orderDelivered: contract.order.orderDelivered,
      quoteExpirationDate: contract.order.quoteExpirationDate,
      orderGrandTotal: contract.order.orderGrandTotal,
      progressPayments: contract.order.progressPayments,
      balanceDue: contract.order.balanceDue,
      salesRep: contract.order.salesRep,
    };
    
    // Generate spreadsheet with invoices
    const spreadsheetBuffer = await generateSpreadsheet(contract.items, location, [], false, order.id);
    
    // Generate filename
    const filename = generateSpreadsheetFilename(location);
    
    // Encode filename for Content-Disposition header
    const encodedFilename = encodeURIComponent(filename);
    const contentDisposition = `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`;
    
    // Return file as response
    return new NextResponse(spreadsheetBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': contentDisposition,
        'Content-Length': spreadsheetBuffer.length.toString(),
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Error generating spreadsheet:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate spreadsheet',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const items: OrderItem[] = body.items || [];
    
    // Try to get contract from database
    let customer = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.dbxCustomerId, params.id))
      .limit(1)
      .then(rows => rows[0]);

    let order;

    if (customer) {
      // Found by customer ID, get the most recent order
      order = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.customerId, customer.dbxCustomerId))
        .orderBy(schema.orders.createdAt)
        .limit(1)
        .then(rows => rows[0]);
    } else {
      // Try to find by order number
      order = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.orderNo, params.id))
        .limit(1)
        .then(rows => rows[0]);

      if (order) {
        customer = await db
          .select()
          .from(schema.customers)
          .where(eq(schema.customers.dbxCustomerId, order.customerId))
          .limit(1)
          .then(rows => rows[0]);
      }
    }

    // Fallback to provided contract data if database lookup fails
    let contract = null;
    if (customer && order) {
      const orderItems = await db
        .select()
        .from(schema.orderItems)
        .where(eq(schema.orderItems.orderId, order.id));
      contract = convertDatabaseToStoredContract(customer, order, orderItems);
    } else if (body.contract) {
      contract = body.contract;
    }
    
    if (!contract) {
      return NextResponse.json(
        { 
          error: 'Contract not found',
          message: 'Contract data is required to generate spreadsheet.',
          id: params.id
        },
        { status: 404 }
      );
    }
    
    // Use provided items if available, otherwise use contract items
    const itemsToUse = items.length > 0 ? items : contract.items;
    
    // Convert stored contract to Location format
    const location: Location = {
      orderNo: contract.order.orderNo,
      streetAddress: contract.customer.streetAddress,
      city: contract.customer.city,
      state: contract.customer.state,
      zip: contract.customer.zip,
      clientName: contract.customer.clientName,
      dbxCustomerId: contract.customer.dbxCustomerId,
      email: contract.customer.email,
      phone: contract.customer.phone,
      orderDate: contract.order.orderDate,
      orderPO: contract.order.orderPO,
      orderDueDate: contract.order.orderDueDate,
      orderType: contract.order.orderType,
      orderDelivered: contract.order.orderDelivered,
      quoteExpirationDate: contract.order.quoteExpirationDate,
      orderGrandTotal: contract.order.orderGrandTotal,
      progressPayments: contract.order.progressPayments,
      balanceDue: contract.order.balanceDue,
      salesRep: contract.order.salesRep,
    };
    
    // Generate spreadsheet with current items and invoices
    // Pass order.id if available to populate invoices
    const orderIdForInvoices = order?.id || contract.id;
    const spreadsheetBuffer = await generateSpreadsheet(itemsToUse, location, [], false, orderIdForInvoices);
    
    // Generate filename
    const filename = generateSpreadsheetFilename(location);
    
    // Encode filename for Content-Disposition header
    const encodedFilename = encodeURIComponent(filename);
    const contentDisposition = `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`;
    
    // Return file as response
    return new NextResponse(spreadsheetBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': contentDisposition,
        'Content-Length': spreadsheetBuffer.length.toString(),
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Error generating spreadsheet:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate spreadsheet',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

