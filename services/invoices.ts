"use server";

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { validateDocument, validateImage } from "@/lib/file-validation";
import { purchaseInvoiceSchema, salesInvoiceSchema, type PurchaseInvoiceInput, type SalesInvoiceInput } from "@/lib/validations/invoice";
import { getPurchaseInvoicesForOwner, getSalesInvoicesForOwner } from "@/lib/invoice-queries";
import { sendInvoiceEmail } from "@/lib/email-service";
import type { PurchaseInvoiceRecord, SalesInvoiceRecord, InvoiceStatus } from "@/types/invoice";

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const user = await getUser();
  return user ?? null;
}

function validateAttachment(fileName?: string, dataUrl?: string): string | null {
  if (!dataUrl) return null;
  const match = /^data:(.+);base64,/.exec(dataUrl);
  const mimeType = match?.[1] ?? "";
  const sizeBytes = Math.round((dataUrl.length * 3) / 4);
  const okDoc = validateDocument(mimeType, sizeBytes).valid;
  const okImg = validateImage(mimeType, sizeBytes).valid;
  if (!okDoc && !okImg) return `${fileName ?? "Attachment"}: unsupported file type or too large.`;
  return null;
}

// ─── Purchase Management ────────────────────────────────────────────────────

export async function getPurchaseInvoicesAction(): Promise<ActionResult<PurchaseInvoiceRecord[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  return { success: true, data: await getPurchaseInvoicesForOwner(user.id) };
}

export async function savePurchaseInvoiceAction(input: PurchaseInvoiceInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const parsed = purchaseInvoiceSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const attErr = validateAttachment(d.attachmentFileName, d.attachmentDataUrl);
  if (attErr) return { success: false, error: attErr };

  const data = {
    vendor: d.vendor.trim(),
    poNumber: d.poNumber?.trim() || null,
    invoiceNumber: d.invoiceNumber.trim(),
    invoiceDate: new Date(d.invoiceDate),
    dueDate: new Date(d.dueDate),
    gst: d.gst,
    shipping: d.shipping,
    totalAmount: d.totalAmount,
    status: d.status,
    notes: d.notes?.trim() || null,
    attachmentFileName: d.attachmentFileName || null,
    attachmentDataUrl: d.attachmentDataUrl || null,
  };

  if (d.id) {
    const existing = await db.purchaseInvoice.findUnique({ where: { id: d.id }, select: { ownerId: true } });
    if (!existing || existing.ownerId !== user.id) return { success: false, error: "Invoice not found." };
    await db.purchaseInvoice.update({ where: { id: d.id }, data });
    return { success: true, data: { id: d.id } };
  }

  const created = await db.purchaseInvoice.create({ data: { ...data, ownerId: user.id }, select: { id: true } });
  return { success: true, data: { id: created.id } };
}

export async function deletePurchaseInvoiceAction(id: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  const existing = await db.purchaseInvoice.findUnique({ where: { id }, select: { ownerId: true } });
  if (!existing || existing.ownerId !== user.id) return { success: false, error: "Invoice not found." };
  await db.purchaseInvoice.delete({ where: { id } });
  return { success: true, data: undefined };
}

export async function duplicatePurchaseInvoiceAction(id: string): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  const existing = await db.purchaseInvoice.findUnique({ where: { id } });
  if (!existing || existing.ownerId !== user.id) return { success: false, error: "Invoice not found." };

  const copy = await db.purchaseInvoice.create({
    data: {
      vendor: existing.vendor,
      poNumber: existing.poNumber,
      invoiceNumber: `${existing.invoiceNumber}-COPY`,
      invoiceDate: existing.invoiceDate,
      dueDate: existing.dueDate,
      gst: existing.gst,
      shipping: existing.shipping,
      totalAmount: existing.totalAmount,
      status: "DRAFT",
      notes: existing.notes,
      ownerId: user.id,
    },
    select: { id: true },
  });
  return { success: true, data: { id: copy.id } };
}

export async function setPurchaseInvoiceStatusAction(id: string, status: InvoiceStatus): Promise<ActionResult<void>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  const existing = await db.purchaseInvoice.findUnique({ where: { id }, select: { ownerId: true } });
  if (!existing || existing.ownerId !== user.id) return { success: false, error: "Invoice not found." };
  await db.purchaseInvoice.update({ where: { id }, data: { status } });
  return { success: true, data: undefined };
}

export async function emailPurchaseInvoiceAction(id: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  const invoice = await db.purchaseInvoice.findUnique({ where: { id } });
  if (!invoice || invoice.ownerId !== user.id) return { success: false, error: "Invoice not found." };

  await sendInvoiceEmail({ recipientLabel: invoice.vendor, invoiceNumber: invoice.invoiceNumber, amount: invoice.totalAmount, dueDate: invoice.dueDate.toISOString() });
  if (invoice.status === "DRAFT") await db.purchaseInvoice.update({ where: { id }, data: { status: "SENT" } });
  return { success: true, data: undefined };
}

// ─── Sales Management ───────────────────────────────────────────────────────

export async function getSalesInvoicesAction(): Promise<ActionResult<SalesInvoiceRecord[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  return { success: true, data: await getSalesInvoicesForOwner(user.id) };
}

export async function saveSalesInvoiceAction(input: SalesInvoiceInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const parsed = salesInvoiceSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const attErr = validateAttachment(d.attachmentFileName, d.attachmentDataUrl);
  if (attErr) return { success: false, error: attErr };

  const itemsTotal = d.items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
  const grandTotal = itemsTotal + d.gst + d.shipping;

  const baseData = {
    customer: d.customer.trim(),
    invoiceNumber: d.invoiceNumber.trim(),
    invoiceDate: new Date(d.invoiceDate),
    dueDate: new Date(d.dueDate),
    gst: d.gst,
    shipping: d.shipping,
    grandTotal,
    paymentStatus: d.paymentStatus,
    notes: d.notes?.trim() || null,
    attachmentFileName: d.attachmentFileName || null,
    attachmentDataUrl: d.attachmentDataUrl || null,
  };

  if (d.id) {
    const existing = await db.salesInvoice.findUnique({ where: { id: d.id }, select: { ownerId: true } });
    if (!existing || existing.ownerId !== user.id) return { success: false, error: "Invoice not found." };

    await db.salesInvoice.update({
      where: { id: d.id },
      data: {
        ...baseData,
        items: {
          deleteMany: {},
          create: d.items.map((it, i) => ({ productName: it.productName.trim(), quantity: it.quantity, unitPrice: it.unitPrice, order: i })),
        },
      },
    });
    return { success: true, data: { id: d.id } };
  }

  const created = await db.salesInvoice.create({
    data: {
      ...baseData,
      ownerId: user.id,
      items: { create: d.items.map((it, i) => ({ productName: it.productName.trim(), quantity: it.quantity, unitPrice: it.unitPrice, order: i })) },
    },
    select: { id: true },
  });
  return { success: true, data: { id: created.id } };
}

export async function deleteSalesInvoiceAction(id: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  const existing = await db.salesInvoice.findUnique({ where: { id }, select: { ownerId: true } });
  if (!existing || existing.ownerId !== user.id) return { success: false, error: "Invoice not found." };
  await db.salesInvoice.delete({ where: { id } });
  return { success: true, data: undefined };
}

export async function duplicateSalesInvoiceAction(id: string): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  const existing = await db.salesInvoice.findUnique({ where: { id }, include: { items: true } });
  if (!existing || existing.ownerId !== user.id) return { success: false, error: "Invoice not found." };

  const copy = await db.salesInvoice.create({
    data: {
      customer: existing.customer,
      invoiceNumber: `${existing.invoiceNumber}-COPY`,
      invoiceDate: existing.invoiceDate,
      dueDate: existing.dueDate,
      gst: existing.gst,
      shipping: existing.shipping,
      grandTotal: existing.grandTotal,
      paymentStatus: "DRAFT",
      notes: existing.notes,
      ownerId: user.id,
      items: { create: existing.items.map((it) => ({ productName: it.productName, quantity: it.quantity, unitPrice: it.unitPrice, order: it.order })) },
    },
    select: { id: true },
  });
  return { success: true, data: { id: copy.id } };
}

export async function setSalesInvoiceStatusAction(id: string, status: InvoiceStatus): Promise<ActionResult<void>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  const existing = await db.salesInvoice.findUnique({ where: { id }, select: { ownerId: true } });
  if (!existing || existing.ownerId !== user.id) return { success: false, error: "Invoice not found." };
  await db.salesInvoice.update({ where: { id }, data: { paymentStatus: status } });
  return { success: true, data: undefined };
}

export async function emailSalesInvoiceAction(id: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  const invoice = await db.salesInvoice.findUnique({ where: { id } });
  if (!invoice || invoice.ownerId !== user.id) return { success: false, error: "Invoice not found." };

  await sendInvoiceEmail({ recipientLabel: invoice.customer, invoiceNumber: invoice.invoiceNumber, amount: invoice.grandTotal, dueDate: invoice.dueDate.toISOString() });
  if (invoice.paymentStatus === "DRAFT") await db.salesInvoice.update({ where: { id }, data: { paymentStatus: "SENT" } });
  return { success: true, data: undefined };
}
