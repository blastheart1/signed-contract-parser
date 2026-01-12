import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { eq, and, inArray, sql } from 'drizzle-orm';

/**
 * GET /api/order-approvals/[id]/items
 * Get selected items for an order approval
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const approvalId = params.id;

    // Verify approval exists and user has access
    const [approval] = await db
      .select()
      .from(schema.orderApprovals)
      .where(eq(schema.orderApprovals.id, approvalId))
      .limit(1);

    if (!approval) {
      return NextResponse.json({ error: 'Order approval not found' }, { status: 404 });
    }

    // Vendor users can only see their own approvals
    if (user.role === 'vendor') {
      if (user.email) {
        const vendorRecord = await db
          .select()
          .from(schema.vendors)
          .where(eq(schema.vendors.email, user.email))
          .limit(1);
        
        if (vendorRecord.length === 0 || vendorRecord[0].id !== approval.vendorId) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Fetch selected items - include snapshot fields (qty, rate, amount) and negotiatedVendorAmount
    // Use try/catch to handle case where snapshot columns don't exist
    let selectedItems;
    try {
      selectedItems = await db
        .select({
          id: schema.orderApprovalItems.id,
          orderItemId: schema.orderApprovalItems.orderItemId,
          createdAt: schema.orderApprovalItems.createdAt,
          qty: schema.orderApprovalItems.qty,
          rate: schema.orderApprovalItems.rate,
          amount: schema.orderApprovalItems.amount,
          negotiatedVendorAmount: schema.orderApprovalItems.negotiatedVendorAmount,
          orderItem: schema.orderItems,
        })
        .from(schema.orderApprovalItems)
        .innerJoin(schema.orderItems, eq(schema.orderApprovalItems.orderItemId, schema.orderItems.id))
        .where(eq(schema.orderApprovalItems.orderApprovalId, approvalId));
    } catch (error: any) {
      // If snapshot columns don't exist, select without them
      if (error?.cause?.code === '42703' || error?.message?.includes('does not exist')) {
        try {
          selectedItems = await db
            .select({
              id: schema.orderApprovalItems.id,
              orderItemId: schema.orderApprovalItems.orderItemId,
              createdAt: schema.orderApprovalItems.createdAt,
              negotiatedVendorAmount: schema.orderApprovalItems.negotiatedVendorAmount,
              orderItem: schema.orderItems,
            })
            .from(schema.orderApprovalItems)
            .innerJoin(schema.orderItems, eq(schema.orderApprovalItems.orderItemId, schema.orderItems.id))
            .where(eq(schema.orderApprovalItems.orderApprovalId, approvalId));
        } catch (fallbackError: any) {
          // If negotiatedVendorAmount also doesn't exist, select base fields only
          if (fallbackError?.cause?.code === '42703' || fallbackError?.message?.includes('does not exist')) {
            selectedItems = await db
              .select({
                id: schema.orderApprovalItems.id,
                orderItemId: schema.orderApprovalItems.orderItemId,
                createdAt: schema.orderApprovalItems.createdAt,
                orderItem: schema.orderItems,
              })
              .from(schema.orderApprovalItems)
              .innerJoin(schema.orderItems, eq(schema.orderApprovalItems.orderItemId, schema.orderItems.id))
              .where(eq(schema.orderApprovalItems.orderApprovalId, approvalId));
          } else {
            throw fallbackError;
          }
        }
      } else {
        throw error;
      }
    }

    return NextResponse.json({
      success: true,
      data: selectedItems,
    });
  } catch (error) {
    console.error('Error fetching approval items:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch approval items',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/order-approvals/[id]/items
 * Update selected items for an order approval
 * Body: { itemIds: string[] } - Array of order item IDs to select
 * 
 * Note: Only allowed in 'draft' stage
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Only non-vendor roles can update item selection
    if (user.role === 'vendor') {
      return NextResponse.json({ error: 'Vendors cannot update item selection' }, { status: 403 });
    }

    const approvalId = params.id;
    const body = await request.json();
    const { itemIds } = body;

    if (!Array.isArray(itemIds)) {
      return NextResponse.json({ error: 'itemIds must be an array' }, { status: 400 });
    }

    // Deduplicate itemIds to prevent unique constraint violations
    const uniqueItemIds = Array.from(new Set(itemIds));

    // Verify approval exists
    const [approval] = await db
      .select()
      .from(schema.orderApprovals)
      .where(eq(schema.orderApprovals.id, approvalId))
      .limit(1);

    if (!approval) {
      return NextResponse.json({ error: 'Order approval not found' }, { status: 404 });
    }

    // Only allow item selection in 'draft' stage
    if (approval.stage !== 'draft') {
      return NextResponse.json(
        { error: 'Item selection can only be changed in draft stage' },
        { status: 400 }
      );
    }

    // Verify all item IDs belong to orders for the approval's customer
    // Since orderId is nullable, we validate by customer instead
    if (uniqueItemIds.length > 0) {
      // First, get all order IDs for this customer
      const customerOrders = await db
        .select({ id: schema.orders.id })
        .from(schema.orders)
        .where(eq(schema.orders.customerId, approval.customerId));

      const customerOrderIds = customerOrders.map(o => o.id);

      if (customerOrderIds.length === 0) {
        return NextResponse.json(
          { error: 'No orders found for this customer' },
          { status: 400 }
        );
      }

      // Verify all items belong to orders for this customer
      const orderItems = await db
        .select()
        .from(schema.orderItems)
        .where(
          and(
            inArray(schema.orderItems.orderId, customerOrderIds),
            inArray(schema.orderItems.id, uniqueItemIds)
          )
        );

      if (orderItems.length !== uniqueItemIds.length) {
        return NextResponse.json(
          { error: 'Some item IDs do not belong to orders for this customer' },
          { status: 400 }
        );
      }
    }

    // Track whether we used fallback path (base columns only)
    let usedFallbackPath = false;

    // Use transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // Delete existing selections
      await tx
        .delete(schema.orderApprovalItems)
        .where(eq(schema.orderApprovalItems.orderApprovalId, approvalId));

      // Insert new selections with snapshot data
      if (uniqueItemIds.length > 0) {
        // Fetch current order item data for snapshot
        const orderItemsForSnapshot = await tx
          .select({
            id: schema.orderItems.id,
            productService: schema.orderItems.productService,
            amount: schema.orderItems.amount,
            qty: schema.orderItems.qty,
            rate: schema.orderItems.rate,
          })
          .from(schema.orderItems)
          .where(inArray(schema.orderItems.id, uniqueItemIds));

        // Create a map for quick lookup
        const orderItemMap = new Map(
          orderItemsForSnapshot.map(item => [item.id, item])
        );

        // Insert items with snapshot data
        // Try with snapshot fields first (if migration 0018 has been applied)
        // Fall back to base fields only if snapshot fields don't exist
        const now = new Date();
        try {
          await tx.insert(schema.orderApprovalItems).values(
            uniqueItemIds.map(orderItemId => {
              const orderItem = orderItemMap.get(orderItemId);
              return {
                orderApprovalId: approvalId,
                orderItemId,
                createdAt: now,
                // Snapshot data (nullable - safe for existing records)
                productService: orderItem?.productService || null,
                amount: '0', // Initially 0 - will be computed as QTY × RATE
                qty: orderItem?.qty ? String(orderItem.qty) : null,
                rate: '0', // Initially 0 - vendor will fill this during negotiation
                negotiatedVendorAmount: null, // Will be updated when user edits amounts
                snapshotDate: now,
              };
            })
          );
        } catch (snapshotError: any) {
          // If snapshot fields don't exist, fall back to base fields only using raw SQL
          if (snapshotError?.cause?.code === '42703' || snapshotError?.message?.includes('does not exist')) {
            console.warn('Snapshot fields not available, inserting with base fields only');
            usedFallbackPath = true;
            // Use ON CONFLICT DO NOTHING to handle any edge cases where DELETE didn't fully clear
            // This ensures idempotency and prevents duplicate key errors
            for (const orderItemId of uniqueItemIds) {
              await tx.execute(sql`
                INSERT INTO "order_approval_items" ("id", "order_approval_id", "order_item_id", "created_at")
                VALUES (gen_random_uuid(), ${approvalId}, ${orderItemId}, ${now})
                ON CONFLICT ("order_approval_id", "order_item_id") DO NOTHING
              `);
            }
          } else {
            throw snapshotError;
          }
        }
      }
    });

    // Fetch updated selections
    // If we used fallback path, only select base columns (same as GET endpoint)
    // Otherwise, select all columns from schema
    let selectedItems;
    if (usedFallbackPath) {
      // Use explicit column selection to avoid schema columns that don't exist
      selectedItems = await db
        .select({
          id: schema.orderApprovalItems.id,
          orderApprovalId: schema.orderApprovalItems.orderApprovalId,
          orderItemId: schema.orderApprovalItems.orderItemId,
          createdAt: schema.orderApprovalItems.createdAt,
        })
        .from(schema.orderApprovalItems)
        .where(eq(schema.orderApprovalItems.orderApprovalId, approvalId));
    } else {
      // Select all columns (snapshot fields exist)
      selectedItems = await db
        .select()
        .from(schema.orderApprovalItems)
        .where(eq(schema.orderApprovalItems.orderApprovalId, approvalId));
    }

    return NextResponse.json({
      success: true,
      data: selectedItems,
    });
  } catch (error) {
    console.error('Error updating approval items:', error);
    return NextResponse.json(
      {
        error: 'Failed to update approval items',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/order-approvals/[id]/items
 * Update order approval items
 * Body: { 
 *   amounts?: Array<{ orderApprovalItemId: string, negotiatedVendorAmount: number | null }>,
 *   qty?: Array<{ orderApprovalItemId: string, qty: number | null }>,
 *   rates?: Array<{ orderApprovalItemId: string, rate: number | null }>
 * }
 * - amounts: Update negotiated vendor amounts (PM only)
 * - qty: Update quantity, compute amount = qty × rate (PM only)
 * - rates: Update rate, compute amount = qty × rate (Vendor only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const approvalId = params.id;
    const body = await request.json();
    const { amounts, qty, rates } = body;

    // Validate input
    if (amounts && !Array.isArray(amounts)) {
      return NextResponse.json({ error: 'amounts must be an array' }, { status: 400 });
    }
    if (qty && !Array.isArray(qty)) {
      return NextResponse.json({ error: 'qty must be an array' }, { status: 400 });
    }
    if (rates && !Array.isArray(rates)) {
      return NextResponse.json({ error: 'rates must be an array' }, { status: 400 });
    }

    // Role-based permissions
    const isVendor = user.role === 'vendor';
    if (amounts && isVendor) {
      return NextResponse.json({ error: 'Vendors cannot update amounts' }, { status: 403 });
    }
    if (qty && isVendor) {
      return NextResponse.json({ error: 'Vendors cannot update qty' }, { status: 403 });
    }
    if (rates && !isVendor) {
      return NextResponse.json({ error: 'Only vendors can update rates' }, { status: 403 });
    }

    // Verify approval exists
    const [approval] = await db
      .select()
      .from(schema.orderApprovals)
      .where(eq(schema.orderApprovals.id, approvalId))
      .limit(1);

    if (!approval) {
      return NextResponse.json({ error: 'Order approval not found' }, { status: 404 });
    }

    // Collect all orderApprovalItemIds to verify
    const allItemIds = [
      ...(amounts || []).map((a: any) => a.orderApprovalItemId),
      ...(qty || []).map((q: any) => q.orderApprovalItemId),
      ...(rates || []).map((r: any) => r.orderApprovalItemId),
    ].filter(Boolean);

    if (allItemIds.length > 0) {
      const existingItems = await db
        .select({ id: schema.orderApprovalItems.id })
        .from(schema.orderApprovalItems)
        .where(
          and(
            eq(schema.orderApprovalItems.orderApprovalId, approvalId),
            inArray(schema.orderApprovalItems.id, allItemIds)
          )
        );

      if (existingItems.length !== allItemIds.length) {
        return NextResponse.json(
          { error: 'Some item IDs do not belong to this approval' },
          { status: 400 }
        );
      }
    }

    // Update using transaction
    await db.transaction(async (tx) => {
      // Update amounts (PM only)
      if (amounts) {
        for (const { orderApprovalItemId, negotiatedVendorAmount } of amounts) {
          if (!orderApprovalItemId) continue;

          const amountValue = negotiatedVendorAmount === null || negotiatedVendorAmount === '' 
            ? null 
            : (typeof negotiatedVendorAmount === 'number' 
                ? negotiatedVendorAmount.toString() 
                : String(negotiatedVendorAmount));

          try {
            await tx
              .update(schema.orderApprovalItems)
              .set({ negotiatedVendorAmount: amountValue })
              .where(eq(schema.orderApprovalItems.id, orderApprovalItemId));
          } catch (updateError: any) {
            if (updateError?.cause?.code === '42703' || updateError?.message?.includes('does not exist')) {
              console.warn('negotiatedVendorAmount column does not exist, skipping update');
            } else {
              throw updateError;
            }
          }
        }
      }

      // Update qty (PM only) - compute amount = qty × rate
      if (qty) {
        for (const { orderApprovalItemId, qty: qtyValue } of qty) {
          if (!orderApprovalItemId) continue;

          // Get current item to fetch rate
          const [currentItem] = await tx
            .select({
              qty: schema.orderApprovalItems.qty,
              rate: schema.orderApprovalItems.rate,
            })
            .from(schema.orderApprovalItems)
            .where(eq(schema.orderApprovalItems.id, orderApprovalItemId))
            .limit(1);

          if (!currentItem) continue;

          const qtyStr = qtyValue === null || qtyValue === '' 
            ? null 
            : (typeof qtyValue === 'number' 
                ? qtyValue.toString() 
                : String(qtyValue));

          // Use rate from snapshot if available, otherwise from order_items
          let rate: number | null = null;
          if (currentItem.rate) {
            rate = parseFloat(String(currentItem.rate));
          } else {
            // Fallback: get rate from order_items
            const [orderApprovalItem] = await tx
              .select({ orderItemId: schema.orderApprovalItems.orderItemId })
              .from(schema.orderApprovalItems)
              .where(eq(schema.orderApprovalItems.id, orderApprovalItemId))
              .limit(1);
            
            if (orderApprovalItem) {
              const [orderItem] = await tx
                .select({ rate: schema.orderItems.rate })
                .from(schema.orderItems)
                .where(eq(schema.orderItems.id, orderApprovalItem.orderItemId))
                .limit(1);
              
              if (orderItem?.rate) {
                rate = parseFloat(String(orderItem.rate));
              }
            }
          }

          // Compute amount = qty × rate
          let amountStr: string | null = null;
          if (qtyStr) {
            const qtyNum = parseFloat(qtyStr);
            if (!isNaN(qtyNum)) {
              // Use rate from snapshot if available, otherwise 0
              const rateValue = rate !== null && !isNaN(rate) ? rate : 0;
              const computedAmount = qtyNum * rateValue;
              amountStr = computedAmount.toString();
            }
          }

          try {
            await tx
              .update(schema.orderApprovalItems)
              .set({ 
                qty: qtyStr,
                amount: amountStr,
              })
              .where(eq(schema.orderApprovalItems.id, orderApprovalItemId));
          } catch (updateError: any) {
            if (updateError?.cause?.code === '42703' || updateError?.message?.includes('does not exist')) {
              console.warn('qty/amount columns do not exist, skipping update');
            } else {
              throw updateError;
            }
          }
        }
      }

      // Update rates (Vendor only) - compute amount = qty × rate
      if (rates) {
        for (const { orderApprovalItemId, rate: rateValue } of rates) {
          if (!orderApprovalItemId) continue;

          // Get current item to fetch qty
          const [currentItem] = await tx
            .select({
              qty: schema.orderApprovalItems.qty,
              rate: schema.orderApprovalItems.rate,
            })
            .from(schema.orderApprovalItems)
            .where(eq(schema.orderApprovalItems.id, orderApprovalItemId))
            .limit(1);

          if (!currentItem) continue;

          const rateStr = rateValue === null || rateValue === '' 
            ? null 
            : (typeof rateValue === 'number' 
                ? rateValue.toString() 
                : String(rateValue));

          // Use qty from snapshot if available, otherwise from order_items
          let qty: number | null = null;
          if (currentItem.qty) {
            qty = parseFloat(String(currentItem.qty));
          } else {
            // Fallback: get qty from order_items
            const [orderApprovalItem] = await tx
              .select({ orderItemId: schema.orderApprovalItems.orderItemId })
              .from(schema.orderApprovalItems)
              .where(eq(schema.orderApprovalItems.id, orderApprovalItemId))
              .limit(1);
            
            if (orderApprovalItem) {
              const [orderItem] = await tx
                .select({ qty: schema.orderItems.qty })
                .from(schema.orderItems)
                .where(eq(schema.orderItems.id, orderApprovalItem.orderItemId))
                .limit(1);
              
              if (orderItem?.qty) {
                qty = parseFloat(String(orderItem.qty));
              }
            }
          }

          // Compute amount = qty × rate
          let amountStr: string | null = null;
          if (qty !== null && !isNaN(qty) && rateStr) {
            const rateNum = parseFloat(rateStr);
            if (!isNaN(rateNum)) {
              const computedAmount = qty * rateNum;
              amountStr = computedAmount.toString();
            }
          }

          try {
            await tx
              .update(schema.orderApprovalItems)
              .set({ 
                rate: rateStr,
                amount: amountStr,
              })
              .where(eq(schema.orderApprovalItems.id, orderApprovalItemId));
          } catch (updateError: any) {
            if (updateError?.cause?.code === '42703' || updateError?.message?.includes('does not exist')) {
              console.warn('rate/amount columns do not exist, skipping update');
            } else {
              throw updateError;
            }
          }
        }
      }
    });

    // Fetch updated items - use same logic as GET endpoint
    let updatedItems;
    try {
      updatedItems = await db
        .select({
          id: schema.orderApprovalItems.id,
          orderItemId: schema.orderApprovalItems.orderItemId,
          createdAt: schema.orderApprovalItems.createdAt,
          qty: schema.orderApprovalItems.qty,
          rate: schema.orderApprovalItems.rate,
          amount: schema.orderApprovalItems.amount,
          negotiatedVendorAmount: schema.orderApprovalItems.negotiatedVendorAmount,
          orderItem: schema.orderItems,
        })
        .from(schema.orderApprovalItems)
        .innerJoin(schema.orderItems, eq(schema.orderApprovalItems.orderItemId, schema.orderItems.id))
        .where(eq(schema.orderApprovalItems.orderApprovalId, approvalId));
    } catch (error: any) {
      if (error?.cause?.code === '42703' || error?.message?.includes('does not exist')) {
        try {
          updatedItems = await db
            .select({
              id: schema.orderApprovalItems.id,
              orderItemId: schema.orderApprovalItems.orderItemId,
              createdAt: schema.orderApprovalItems.createdAt,
              negotiatedVendorAmount: schema.orderApprovalItems.negotiatedVendorAmount,
              orderItem: schema.orderItems,
            })
            .from(schema.orderApprovalItems)
            .innerJoin(schema.orderItems, eq(schema.orderApprovalItems.orderItemId, schema.orderItems.id))
            .where(eq(schema.orderApprovalItems.orderApprovalId, approvalId));
        } catch (fallbackError: any) {
          if (fallbackError?.cause?.code === '42703' || fallbackError?.message?.includes('does not exist')) {
            updatedItems = await db
              .select({
                id: schema.orderApprovalItems.id,
                orderItemId: schema.orderApprovalItems.orderItemId,
                createdAt: schema.orderApprovalItems.createdAt,
                orderItem: schema.orderItems,
              })
              .from(schema.orderApprovalItems)
              .innerJoin(schema.orderItems, eq(schema.orderApprovalItems.orderItemId, schema.orderItems.id))
              .where(eq(schema.orderApprovalItems.orderApprovalId, approvalId));
          } else {
            throw fallbackError;
          }
        }
      } else {
        throw error;
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedItems,
    });
  } catch (error) {
    console.error('Error updating approval item amounts:', error);
    return NextResponse.json(
      {
        error: 'Failed to update approval item amounts',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

