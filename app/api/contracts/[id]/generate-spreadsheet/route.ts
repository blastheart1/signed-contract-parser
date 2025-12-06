import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { convertDatabaseToStoredContract } from '@/lib/db/contractHelpers';
import { generateSpreadsheet } from '@/lib/spreadsheetGenerator';
import { generateSpreadsheetFilename } from '@/lib/filenameGenerator';
import { Location, OrderItem } from '@/lib/tableExtractor';
import { AddendumData } from '@/lib/addendumParser';
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
    
    // Separate items into main items and addendums
    const mainItems: OrderItem[] = [];
    const addendums: AddendumData[] = [];
    let currentAddendum: AddendumData | null = null;
    let blankRowCount = 0;
    
    for (const item of contract.items) {
      const itemAny = item as any;
      
      // Skip blank rows (they're just separators)
      if (itemAny.isBlankRow) {
        blankRowCount++;
        continue;
      }
      
      // Check if this is an addendum header
      if (itemAny.isAddendumHeader) {
        // Save previous addendum if exists
        if (currentAddendum) {
          addendums.push(currentAddendum);
        }
        
        // Start new addendum
        currentAddendum = {
          addendumNumber: itemAny.addendumNumber || '',
          urlId: itemAny.addendumUrlId || itemAny.addendumNumber || '',
          url: '', // URL not stored in database
          items: [],
        };
        continue;
      }
      
      // Check if we're inside an addendum (columnBLabel === 'Addendum')
      if (itemAny.columnBLabel === 'Addendum' && currentAddendum) {
        // Add to current addendum
        currentAddendum.items.push(item);
      } else if (itemAny.columnBLabel === 'Addendum' && !currentAddendum) {
        // Item marked as addendum but no header found - skip or handle as error
        console.warn('Found addendum item without header:', item);
        continue;
      } else {
        // Regular item - add to main items
        mainItems.push(item);
      }
    }
    
    // Don't forget the last addendum
    if (currentAddendum && currentAddendum.items.length > 0) {
      addendums.push(currentAddendum);
    }
    
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
    
    // Get project status fields from order
    const projectStatus = {
      stage: order.stage || undefined,
      contractDate: order.contractDate || undefined,
      firstBuildInvoiceDate: order.firstBuildInvoiceDate || undefined,
      projectStartDate: order.projectStartDate || undefined,
      projectEndDate: order.projectEndDate || undefined,
    };
    
    // Generate spreadsheet with invoices and reconstructed addendums
    const spreadsheetBuffer = await generateSpreadsheet(mainItems, location, addendums, false, order.id, projectStatus);
    
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
    
    // Use provided items if available, otherwise reconstruct from contract items
    let itemsToUse: OrderItem[] = [];
    let addendumsToUse: AddendumData[] = [];
    
    if (items.length > 0) {
      // Use provided items (already have addendums separated)
      itemsToUse = items;
    } else {
      // Reconstruct from contract items (same logic as GET route)
      let currentAddendum: AddendumData | null = null;
      
      for (const item of contract.items) {
        const itemAny = item as any;
        
        // Skip blank rows
        if (itemAny.isBlankRow) {
          continue;
        }
        
        // Check if this is an addendum header
        if (itemAny.isAddendumHeader) {
          // Save previous addendum if exists
          if (currentAddendum) {
            addendumsToUse.push(currentAddendum);
          }
          
          // Start new addendum
          currentAddendum = {
            addendumNumber: itemAny.addendumNumber || '',
            urlId: itemAny.addendumUrlId || itemAny.addendumNumber || '',
            url: '',
            items: [],
          };
          continue;
        }
        
        // Check if we're inside an addendum
        if (itemAny.columnBLabel === 'Addendum' && currentAddendum) {
          currentAddendum.items.push(item);
        } else if (itemAny.columnBLabel === 'Addendum' && !currentAddendum) {
          console.warn('Found addendum item without header:', item);
          continue;
        } else {
          // Regular item
          itemsToUse.push(item);
        }
      }
      
      // Don't forget the last addendum
      if (currentAddendum && currentAddendum.items.length > 0) {
        addendumsToUse.push(currentAddendum);
      }
    }
    
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
    
    // Get project status fields from order or contract
    const projectStatus = order ? {
      stage: order.stage || undefined,
      contractDate: order.contractDate || undefined,
      firstBuildInvoiceDate: order.firstBuildInvoiceDate || undefined,
      projectStartDate: order.projectStartDate || undefined,
      projectEndDate: order.projectEndDate || undefined,
    } : (contract.order as any) ? {
      stage: (contract.order as any).stage || undefined,
      contractDate: (contract.order as any).contractDate || undefined,
      firstBuildInvoiceDate: (contract.order as any).firstBuildInvoiceDate || undefined,
      projectStartDate: (contract.order as any).projectStartDate || undefined,
      projectEndDate: (contract.order as any).projectEndDate || undefined,
    } : undefined;
    
    // Generate spreadsheet with current items and reconstructed addendums
    const orderIdForInvoices = order?.id || contract.id;
    const spreadsheetBuffer = await generateSpreadsheet(itemsToUse, location, addendumsToUse, false, orderIdForInvoices, projectStatus);
    
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

