import { db, schema } from './index';
import { eq, and } from 'drizzle-orm';
import type { StoredContract } from '@/lib/store/contractStore';
import type { OrderItem } from '@/lib/tableExtractor';

/**
 * Convert StoredContract to database format and save
 */
export async function saveContractToDatabase(contract: StoredContract) {
  // Ensure dbx_customer_id exists (required for primary key)
  if (!contract.customer.dbxCustomerId) {
    throw new Error('dbxCustomerId is required for database storage');
  }

  const dbxCustomerId = contract.customer.dbxCustomerId;

  // Upsert customer (create or update)
  await db
    .insert(schema.customers)
    .values({
      dbxCustomerId: dbxCustomerId,
      clientName: contract.customer.clientName,
      email: contract.customer.email || null,
      phone: contract.customer.phone || null,
      streetAddress: contract.customer.streetAddress,
      city: contract.customer.city,
      state: contract.customer.state,
      zip: contract.customer.zip,
    })
    .onConflictDoUpdate({
      target: schema.customers.dbxCustomerId,
      set: {
        clientName: contract.customer.clientName,
        email: contract.customer.email || null,
        phone: contract.customer.phone || null,
        streetAddress: contract.customer.streetAddress,
        city: contract.customer.city,
        state: contract.customer.state,
        zip: contract.customer.zip,
        updatedAt: new Date(),
      },
    });

  // Insert order
  const [order] = await db
    .insert(schema.orders)
    .values({
      customerId: dbxCustomerId, // String FK to customers
      orderNo: contract.order.orderNo,
      orderDate: contract.order.orderDate ? new Date(contract.order.orderDate) : null,
      orderPO: contract.order.orderPO || null,
      orderDueDate: contract.order.orderDueDate ? new Date(contract.order.orderDueDate) : null,
      orderType: contract.order.orderType || null,
      orderDelivered: contract.order.orderDelivered || false,
      quoteExpirationDate: contract.order.quoteExpirationDate ? new Date(contract.order.quoteExpirationDate) : null,
      orderGrandTotal: contract.order.orderGrandTotal.toString(),
      progressPayments: contract.order.progressPayments || null,
      balanceDue: contract.order.balanceDue.toString(),
      salesRep: contract.order.salesRep || null,
      emlBlobUrl: null, // For future implementation
      emlFilename: null, // For future implementation
    })
    .onConflictDoUpdate({
      target: schema.orders.orderNo,
      set: {
        customerId: dbxCustomerId,
        orderDate: contract.order.orderDate ? new Date(contract.order.orderDate) : null,
        orderPO: contract.order.orderPO || null,
        orderDueDate: contract.order.orderDueDate ? new Date(contract.order.orderDueDate) : null,
        orderType: contract.order.orderType || null,
        orderDelivered: contract.order.orderDelivered || false,
        quoteExpirationDate: contract.order.quoteExpirationDate ? new Date(contract.order.quoteExpirationDate) : null,
        orderGrandTotal: contract.order.orderGrandTotal.toString(),
        progressPayments: contract.order.progressPayments || null,
        balanceDue: contract.order.balanceDue.toString(),
        salesRep: contract.order.salesRep || null,
        updatedAt: new Date(),
      },
    })
    .returning();

  // Delete existing order items for this order
  await db
    .delete(schema.orderItems)
    .where(eq(schema.orderItems.orderId, order.id));

  // Insert order items
  if (contract.items && contract.items.length > 0) {
    const orderItemsToInsert = contract.items.map((item: any, index: number) => {
      // Determine column A label
      let columnALabel = '1 - Detail';
      if ((item as any).isBlankRow) {
        columnALabel = '1 - Blank Row';
      } else if ((item as any).isAddendumHeader || item.type === 'maincategory') {
        columnALabel = '1 - Header';
      } else if (item.type === 'subcategory') {
        columnALabel = '1 - Subheader';
      }
      
      // Get column B label from item (default to 'Initial' if not set)
      const columnBLabel = (item as any).columnBLabel || 'Initial';
      
      return {
        orderId: order.id,
        rowIndex: index,
        columnALabel,
        columnBLabel,
      productService: item.productService || '',
      qty: item.qty ? (typeof item.qty === 'number' ? item.qty.toString() : item.qty) : null,
      rate: item.rate ? (typeof item.rate === 'number' ? item.rate.toString() : item.rate) : null,
      amount: item.amount ? (typeof item.amount === 'number' ? item.amount.toString() : item.amount) : null,
      progressOverallPct: item.progressOverallPct ? (typeof item.progressOverallPct === 'number' ? item.progressOverallPct.toString() : item.progressOverallPct) : null,
      completedAmount: item.completedAmount ? (typeof item.completedAmount === 'number' ? item.completedAmount.toString() : item.completedAmount) : null,
      previouslyInvoicedPct: item.previouslyInvoicedPct ? (typeof item.previouslyInvoicedPct === 'number' ? item.previouslyInvoicedPct.toString() : item.previouslyInvoicedPct) : null,
      previouslyInvoicedAmount: item.previouslyInvoicedAmount ? (typeof item.previouslyInvoicedAmount === 'number' ? item.previouslyInvoicedAmount.toString() : item.previouslyInvoicedAmount) : null,
      newProgressPct: item.newProgressPct ? (typeof item.newProgressPct === 'number' ? item.newProgressPct.toString() : item.newProgressPct) : null,
      thisBill: item.thisBill ? (typeof item.thisBill === 'number' ? item.thisBill.toString() : item.thisBill) : null,
      itemType: item.type,
      mainCategory: item.mainCategory || null,
      subCategory: item.subCategory || null,
      };
    });

    await db.insert(schema.orderItems).values(orderItemsToInsert);
  }

  return order;
}

/**
 * Convert database records to StoredContract format
 */
export function convertDatabaseToStoredContract(
  customer: typeof schema.customers.$inferSelect,
  order: typeof schema.orders.$inferSelect,
  orderItems: (typeof schema.orderItems.$inferSelect)[]
): StoredContract {
  // Convert order items back to OrderItem format, preserving addendum structure
  const items: any[] = orderItems
    .sort((a, b) => a.rowIndex - b.rowIndex)
    .map((item) => {
      const convertedItem: any = {
        type: item.itemType,
        productService: item.productService,
        qty: item.qty ? parseFloat(item.qty) : '',
        rate: item.rate ? parseFloat(item.rate) : '',
        amount: item.amount ? parseFloat(item.amount) : '',
        mainCategory: item.mainCategory || undefined,
        subCategory: item.subCategory || undefined,
        progressOverallPct: item.progressOverallPct ? parseFloat(item.progressOverallPct) : undefined,
        completedAmount: item.completedAmount ? parseFloat(item.completedAmount) : undefined,
        previouslyInvoicedPct: item.previouslyInvoicedPct ? parseFloat(item.previouslyInvoicedPct) : undefined,
        previouslyInvoicedAmount: item.previouslyInvoicedAmount ? parseFloat(item.previouslyInvoicedAmount) : undefined,
        newProgressPct: item.newProgressPct ? parseFloat(item.newProgressPct) : undefined,
        thisBill: item.thisBill ? parseFloat(item.thisBill) : undefined,
        columnBLabel: item.columnBLabel || 'Initial', // Preserve column B label
      };
      
      // Preserve addendum header marker
      if (item.columnALabel === '1 - Blank Row') {
        convertedItem.isBlankRow = true;
      } else if (item.columnBLabel === 'Addendum' && item.columnALabel === '1 - Header' && 
                 item.productService && item.productService.startsWith('Addendum #')) {
        convertedItem.isAddendumHeader = true;
        // Extract addendum number and URL ID from header text
        const match = item.productService.match(/Addendum #(\d+) \((\d+)\)/);
        if (match) {
          convertedItem.addendumNumber = match[1];
          convertedItem.addendumUrlId = match[2];
        }
      }
      
      return convertedItem;
    });

  return {
    id: order.id,
    customer: {
      dbxCustomerId: customer.dbxCustomerId,
      clientName: customer.clientName,
      email: customer.email || undefined,
      phone: customer.phone || undefined,
      streetAddress: customer.streetAddress,
      city: customer.city,
      state: customer.state,
      zip: customer.zip,
    },
    order: {
      orderNo: order.orderNo,
      orderDate: order.orderDate ? order.orderDate.toISOString() : undefined,
      orderPO: order.orderPO || undefined,
      orderDueDate: order.orderDueDate ? order.orderDueDate.toISOString() : undefined,
      orderType: order.orderType || undefined,
      orderDelivered: order.orderDelivered || false,
      quoteExpirationDate: order.quoteExpirationDate ? order.quoteExpirationDate.toISOString() : undefined,
      orderGrandTotal: parseFloat(order.orderGrandTotal),
      progressPayments: order.progressPayments || undefined,
      balanceDue: parseFloat(order.balanceDue),
      salesRep: order.salesRep || undefined,
    },
    items,
    parsedAt: order.createdAt,
  };
}

