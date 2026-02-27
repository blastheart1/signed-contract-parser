/**
 * Order approval email HTML + minimal payload builder for Zapier.
 *
 * NOTE: This file is intentionally pure (no side effects); routes can call the
 * builder and post the returned payload to a webhook.
 */

import { db, schema } from '@/lib/db';
import { and, eq, isNull } from 'drizzle-orm';

const CONSENT_REMINDER =
  'When you approved this order, you acknowledged and agreed that your approval decision, your organization name, and the approval timestamp are permanently recorded; that this approval is a binding business, legal, and compliance record; that you had reviewed the product/service descriptions, quantities, rates, and amounts; and that you were authorized to approve on behalf of your organization.';

export type OrderApprovalEmailPayload = {
  htmlEmail: string;
  subject: string;
  referenceNo: string;
  approvalId: string;
  vendorEmail: string;
  approvedAt: string;
  triggerSource: 'manual_button';
  testMode: true;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatQty(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toFixed(2);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderOrderApprovalHtml(data: {
  referenceNo: string;
  customerName: string;
  projectManagerEmail: string;
  vendorContact: string;
  vendorPhone: string;
  vendorEmail: string;
  approvalTimestamp: string;
  consentReminder: string;
  items: Array<{ productService: string; qty: number; rate: number; amount: number }>;
}): string {
  const rowsHtml = data.items
    .map((item, index) => {
      const background = index % 2 === 1 ? 'background-color:#f9f9f9;' : '';
      return `
        <tr style="${background}">
          <td style="border:1px solid #dddddd; padding:10px 8px; font-family:Arial,sans-serif; font-size:13px; color:#232F47; max-width:260px; word-wrap:break-word; overflow-wrap:break-word;">${escapeHtml(
            item.productService
          )}</td>
          <td style="border:1px solid #dddddd; padding:10px 8px; text-align:right; font-family:Arial,sans-serif; font-size:13px; color:#232F47;">${escapeHtml(
            formatQty(item.qty)
          )}</td>
          <td style="border:1px solid #dddddd; padding:10px 8px; text-align:right; font-family:Arial,sans-serif; font-size:13px; color:#232F47;">${escapeHtml(
            formatCurrency(item.rate)
          )}</td>
          <td style="border:1px solid #dddddd; padding:10px 8px; text-align:right; font-family:Arial,sans-serif; font-size:13px; color:#232F47;">${escapeHtml(
            formatCurrency(item.amount)
          )}</td>
        </tr>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
<meta content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" name="viewport">
<style type="text/css">
  @media screen and (max-device-width: 600px), screen and (max-width: 600px) {
    .deviceWidth { width: 100% !important; min-width: 100% !important; }
  }
</style>
</head>
<body bgcolor="#fff" style="margin:0; padding:0; background-color:#fff;">
<table bgcolor="#fff" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%; min-width:100%; table-layout:fixed; margin:0 auto;">
  <tr>
    <td align="center">
      <table width="600" class="deviceWidth" bgcolor="#fff" align="center" border="0" cellpadding="0" cellspacing="0" style="table-layout:fixed; margin:0 auto; width:600px; min-width:600px;">
        <tr>
          <td valign="top" style="background-color:#fff; padding-left:30px; padding-right:30px; padding-top:26px; padding-bottom:12px; text-align:center;">
            <img src="https://login.prodbx.com/go/view/?16250.426.20231214133638.4aZvXA" width="347" height="90" style="width:347px; max-width:100%; height:auto; border:0; vertical-align:top;" alt="Calimingo Pools">
          </td>
        </tr>
        <tr>
          <td valign="top" style="background-color:#fff; padding-left:30px; padding-right:30px; padding-top:10px; padding-bottom:20px; text-align:center;">
            <img src="https://login.prodbx.com/go/view/?24552.426.20240705133643.Hrs6MC" width="540" height="123" style="width:100%; height:auto; border:0; vertical-align:top;" alt="Calimingo Header">
          </td>
        </tr>
        <tr>
          <td style="padding:0 35px 8px; font-family:Arial,sans-serif; font-size:28px; line-height:34px; color:#D79A29;">
            Order Approval Confirmation
          </td>
        </tr>
        <tr>
          <td style="padding:0 35px 20px; font-family:Arial,sans-serif; font-size:13px; line-height:22px; color:#232F47;">
            This email serves as an official copy of approved vendor order items for your records.
          </td>
        </tr>
        <tr>
          <td style="padding:0 35px 20px;">
            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;">
              <tr><td style="padding:6px 0; width:210px; font-family:Arial,sans-serif; font-size:13px; font-weight:bold; color:#232F47;">Reference No:</td><td style="padding:6px 0; font-family:Arial,sans-serif; font-size:13px; color:#232F47;">${escapeHtml(
                data.referenceNo
              )}</td></tr>
              <tr><td style="padding:6px 0; font-family:Arial,sans-serif; font-size:13px; font-weight:bold; color:#232F47;">Customer Name:</td><td style="padding:6px 0; font-family:Arial,sans-serif; font-size:13px; color:#232F47;">${escapeHtml(
                data.customerName
              )}</td></tr>
              <tr><td style="padding:6px 0; font-family:Arial,sans-serif; font-size:13px; font-weight:bold; color:#232F47;">Project Manager:</td><td style="padding:6px 0; font-family:Arial,sans-serif; font-size:13px; color:#232F47;">${escapeHtml(
                data.projectManagerEmail
              )}</td></tr>
              <tr><td style="padding:6px 0; font-family:Arial,sans-serif; font-size:13px; font-weight:bold; color:#232F47;">Vendor Contact Person / Name:</td><td style="padding:6px 0; font-family:Arial,sans-serif; font-size:13px; color:#232F47;">${escapeHtml(
                data.vendorContact
              )}</td></tr>
              <tr><td style="padding:6px 0; font-family:Arial,sans-serif; font-size:13px; font-weight:bold; color:#232F47;">Vendor Contact Number:</td><td style="padding:6px 0; font-family:Arial,sans-serif; font-size:13px; color:#232F47;">${escapeHtml(
                data.vendorPhone
              )}</td></tr>
              <tr><td style="padding:6px 0; font-family:Arial,sans-serif; font-size:13px; font-weight:bold; color:#232F47;">Vendor Email:</td><td style="padding:6px 0; font-family:Arial,sans-serif; font-size:13px; color:#232F47;">${escapeHtml(
                data.vendorEmail
              )}</td></tr>
              <tr><td style="padding:6px 0; font-family:Arial,sans-serif; font-size:13px; font-weight:bold; color:#232F47;">Vendor Approval Timestamp:</td><td style="padding:6px 0; font-family:Arial,sans-serif; font-size:13px; color:#232F47;">${escapeHtml(
                data.approvalTimestamp
              )}</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 35px 12px; font-family:Arial,sans-serif; font-size:18px; line-height:24px; color:#D79A29;">
            Acknowledgement and consent
          </td>
        </tr>
        <tr>
          <td style="padding:0 35px 24px; font-family:Arial,sans-serif; font-size:13px; line-height:22px; color:#232F47;">
            ${escapeHtml(data.consentReminder)}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 35px 12px; font-family:Arial,sans-serif; font-size:18px; line-height:24px; color:#D79A29;">
            Order Items
          </td>
        </tr>
        <tr>
          <td style="padding:0 35px 32px;">
            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; table-layout:fixed;">
              <thead>
                <tr style="background:#232F47;">
                  <th style="border:1px solid #232F47; padding:10px 8px; text-align:left; color:#fff; width:45%; max-width:260px; word-wrap:break-word; overflow-wrap:break-word; font-family:Arial,sans-serif; font-size:13px;">PRODUCT/SERVICE</th>
                  <th style="border:1px solid #232F47; padding:10px 8px; text-align:right; color:#fff; width:15%; font-family:Arial,sans-serif; font-size:13px;">QTY</th>
                  <th style="border:1px solid #232F47; padding:10px 8px; text-align:right; color:#fff; width:20%; font-family:Arial,sans-serif; font-size:13px;">RATE</th>
                  <th style="border:1px solid #232F47; padding:10px 8px; text-align:right; color:#fff; width:20%; font-family:Arial,sans-serif; font-size:13px;">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 30px; background:#232F47; color:#ffffff; font-family:Arial,sans-serif; font-size:13px; line-height:22px; text-align:center;">
            This is an automated copy of the approved order. Retain for your records.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
  `.trim();
}

export async function buildOrderApprovalEmailPayload(approvalId: string): Promise<OrderApprovalEmailPayload | null> {
  const [approval] = await db
    .select({
      id: schema.orderApprovals.id,
      referenceNo: schema.orderApprovals.referenceNo,
      vendorApprovedAt: schema.orderApprovals.vendorApprovedAt,
      updatedAt: schema.orderApprovals.updatedAt,
      customerName: schema.customers.clientName,
      vendorName: schema.vendors.name,
      vendorPhone: schema.vendors.phone,
      vendorEmail: schema.vendors.email,
      vendorContactPerson: schema.vendors.contactPerson,
      projectManagerEmail: schema.users.email,
    })
    .from(schema.orderApprovals)
    .leftJoin(schema.customers, eq(schema.orderApprovals.customerId, schema.customers.dbxCustomerId))
    .leftJoin(schema.vendors, eq(schema.orderApprovals.vendorId, schema.vendors.id))
    .leftJoin(schema.users, eq(schema.orderApprovals.createdBy, schema.users.id))
    .where(and(eq(schema.orderApprovals.id, approvalId), isNull(schema.orderApprovals.deletedAt)))
    .limit(1);

  if (!approval) return null;

  const approvalItems = await db
    .select({
      productService: schema.orderApprovalItems.productService,
      qty: schema.orderApprovalItems.qty,
      rate: schema.orderApprovalItems.rate,
      amount: schema.orderApprovalItems.amount,
    })
    .from(schema.orderApprovalItems)
    .where(eq(schema.orderApprovalItems.orderApprovalId, approvalId));

  const items = approvalItems.length
    ? approvalItems.map((item) => {
        const qty = Number(item.qty ?? 0);
        const rate = Number(item.rate ?? 0);
        const amount = Number(item.amount ?? (qty * rate));
        return {
          productService: item.productService?.trim() || 'Untitled Item',
          qty: Number.isFinite(qty) ? qty : 0,
          rate: Number.isFinite(rate) ? rate : 0,
          amount: Number.isFinite(amount) ? amount : 0,
        };
      })
    : [];

  const approvalTimestamp = new Date(approval.vendorApprovedAt || approval.updatedAt).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'long',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });

  const referenceNo = approval.referenceNo || '—';
  const customerName = approval.customerName || '—';
  const projectManagerEmail = approval.projectManagerEmail || '—';
  const vendorName = approval.vendorName || '—';
  const vendorContactPerson = approval.vendorContactPerson || '—';
  const vendorPhone = approval.vendorPhone || '—';
  const vendorEmail = approval.vendorEmail || '';

  const htmlEmail = renderOrderApprovalHtml({
    referenceNo,
    customerName,
    projectManagerEmail,
    vendorContact: `${vendorContactPerson} / ${vendorName}`,
    vendorPhone,
    vendorEmail,
    approvalTimestamp,
    consentReminder: CONSENT_REMINDER,
    items,
  });

  const approvedAt =
    approval.vendorApprovedAt instanceof Date
      ? approval.vendorApprovedAt.toISOString()
      : approval.updatedAt instanceof Date
        ? approval.updatedAt.toISOString()
        : new Date().toISOString();

  return {
    htmlEmail,
    subject: `Order Approval Confirmation - ${referenceNo}`,
    referenceNo,
    approvalId,
    vendorEmail,
    approvedAt,
    triggerSource: 'manual_button',
    testMode: true,
  };
}

