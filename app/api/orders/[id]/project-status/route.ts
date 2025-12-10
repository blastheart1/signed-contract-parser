import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { logStageUpdate, logOrderEdit, logCustomerEdit, valueToString } from '@/lib/services/changeHistory';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getSession();
    
    if (!session || !session.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { stage, contractDate, firstBuildInvoiceDate, projectStartDate, projectEndDate } = body;

    console.log('[PATCH /api/orders/[id]/project-status] Received data:', {
      orderId: params.id,
      stage,
      contractDate,
      firstBuildInvoiceDate,
      projectStartDate,
      projectEndDate,
    });

    // Validate date formats if provided (MM/DD/YYYY)
    const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;
    if (contractDate && !dateRegex.test(contractDate)) {
      return NextResponse.json(
        { success: false, error: 'Invalid contractDate format. Expected MM/DD/YYYY' },
        { status: 400 }
      );
    }
    if (firstBuildInvoiceDate && !dateRegex.test(firstBuildInvoiceDate)) {
      return NextResponse.json(
        { success: false, error: 'Invalid firstBuildInvoiceDate format. Expected MM/DD/YYYY' },
        { status: 400 }
      );
    }
    if (projectStartDate && !dateRegex.test(projectStartDate)) {
      return NextResponse.json(
        { success: false, error: 'Invalid projectStartDate format. Expected MM/DD/YYYY' },
        { status: 400 }
      );
    }
    if (projectEndDate && !dateRegex.test(projectEndDate)) {
      return NextResponse.json(
        { success: false, error: 'Invalid projectEndDate format. Expected MM/DD/YYYY' },
        { status: 400 }
      );
    }

    // Validate stage value if provided
    if (stage && !['waiting_for_permit', 'active', 'completed'].includes(stage)) {
      return NextResponse.json(
        { success: false, error: 'Invalid stage value. Must be one of: waiting_for_permit, active, completed' },
        { status: 400 }
      );
    }

    // Fetch existing order to compare values for logging
    const existingOrder = await db.query.orders.findFirst({
      where: eq(schema.orders.id, params.id),
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Build update object with only provided fields
    const updateData: any = {
      updatedAt: new Date(),
      updatedBy: session.id,
    };

    if (stage !== undefined) updateData.stage = stage || null;
    if (contractDate !== undefined) updateData.contractDate = contractDate || null;
    if (firstBuildInvoiceDate !== undefined) updateData.firstBuildInvoiceDate = firstBuildInvoiceDate || null;
    if (projectStartDate !== undefined) updateData.projectStartDate = projectStartDate || null;
    if (projectEndDate !== undefined) updateData.projectEndDate = projectEndDate || null;

    // Update the order
    console.log('[PATCH /api/orders/[id]/project-status] Updating order with data:', updateData);
    const updatedOrder = await db
      .update(schema.orders)
      .set(updateData)
      .where(eq(schema.orders.id, params.id))
      .returning();

    if (updatedOrder.length === 0) {
      console.error('[PATCH /api/orders/[id]/project-status] Order not found:', params.id);
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    console.log('[PATCH /api/orders/[id]/project-status] Successfully updated order:', {
      orderId: updatedOrder[0].id,
      stage: updatedOrder[0].stage,
      contractDate: updatedOrder[0].contractDate,
      firstBuildInvoiceDate: updatedOrder[0].firstBuildInvoiceDate,
      projectStartDate: updatedOrder[0].projectStartDate,
      projectEndDate: updatedOrder[0].projectEndDate,
    });

    // Log stage changes
    if (stage !== undefined && existingOrder.stage !== stage) {
      await logStageUpdate(
        existingOrder.stage,
        stage || null,
        params.id,
        existingOrder.customerId
      );
    }

    // Log project date changes
    const dateFields = [
      { name: 'contractDate', old: existingOrder.contractDate, new: contractDate },
      { name: 'firstBuildInvoiceDate', old: existingOrder.firstBuildInvoiceDate, new: firstBuildInvoiceDate },
      { name: 'projectStartDate', old: existingOrder.projectStartDate, new: projectStartDate },
      { name: 'projectEndDate', old: existingOrder.projectEndDate, new: projectEndDate },
    ];

    for (const field of dateFields) {
      if (field.new !== undefined) {
        const oldStr = valueToString(field.old);
        const newStr = valueToString(field.new);
        if (oldStr !== newStr) {
          await logOrderEdit(
            field.name,
            oldStr,
            newStr,
            params.id,
            existingOrder.customerId
          );
        }
      }
    }

    // If stage is set to 'completed', automatically set customer status to 'completed'
    if (stage === 'completed') {
      const existingCustomer = await db.query.customers.findFirst({
        where: eq(schema.customers.dbxCustomerId, existingOrder.customerId),
      });

      if (existingCustomer && existingCustomer.status !== 'completed') {
        // Log the customer status change
        await logCustomerEdit(
          'status',
          valueToString(existingCustomer.status),
          'completed',
          existingOrder.customerId
        );

        await db.update(schema.customers)
          .set({
            status: 'completed',
            updatedAt: new Date(),
          })
          .where(eq(schema.customers.dbxCustomerId, existingOrder.customerId));
        
        console.log(`[PATCH /api/orders/[id]/project-status] Updated customer ${existingOrder.customerId} status to 'completed' because stage is 'completed'`);
      }
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder[0],
    });
  } catch (error) {
    console.error('Error updating project status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update project status' },
      { status: 500 }
    );
  }
}

