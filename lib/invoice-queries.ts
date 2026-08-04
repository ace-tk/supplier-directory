// Real, DB-backed read layer for Invoice Management — scoped per user across
// all four portals.

import { db } from "@/lib/db";
import type { PurchaseInvoiceRecord, SalesInvoiceRecord } from "@/types/invoice";

function mapPurchase(inv: {
  id: string;
  vendor: string;
  poNumber: string | null;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  gst: number;
  shipping: number;
  totalAmount: number;
  status: PurchaseInvoiceRecord["status"];
  notes: string | null;
  attachmentFileName: string | null;
  attachmentDataUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PurchaseInvoiceRecord {
  return {
    id: inv.id,
    vendor: inv.vendor,
    poNumber: inv.poNumber,
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate.toISOString(),
    dueDate: inv.dueDate.toISOString(),
    gst: inv.gst,
    shipping: inv.shipping,
    totalAmount: inv.totalAmount,
    status: inv.status,
    notes: inv.notes,
    attachmentFileName: inv.attachmentFileName,
    attachmentDataUrl: inv.attachmentDataUrl,
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
  };
}

export async function getPurchaseInvoicesForOwner(ownerId: string): Promise<PurchaseInvoiceRecord[]> {
  const rows = await db.purchaseInvoice.findMany({ where: { ownerId }, orderBy: { invoiceDate: "desc" } });
  return rows.map(mapPurchase);
}

function mapSales(inv: {
  id: string;
  customer: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  gst: number;
  shipping: number;
  grandTotal: number;
  paymentStatus: SalesInvoiceRecord["paymentStatus"];
  notes: string | null;
  attachmentFileName: string | null;
  attachmentDataUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: { id: string; productName: string; quantity: number; unitPrice: number; order: number }[];
}): SalesInvoiceRecord {
  return {
    id: inv.id,
    customer: inv.customer,
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate.toISOString(),
    dueDate: inv.dueDate.toISOString(),
    items: inv.items.map((i) => ({ id: i.id, productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice, order: i.order })),
    gst: inv.gst,
    shipping: inv.shipping,
    grandTotal: inv.grandTotal,
    paymentStatus: inv.paymentStatus,
    notes: inv.notes,
    attachmentFileName: inv.attachmentFileName,
    attachmentDataUrl: inv.attachmentDataUrl,
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
  };
}

export async function getSalesInvoicesForOwner(ownerId: string): Promise<SalesInvoiceRecord[]> {
  const rows = await db.salesInvoice.findMany({
    where: { ownerId },
    include: { items: { orderBy: { order: "asc" } } },
    orderBy: { invoiceDate: "desc" },
  });
  return rows.map(mapSales);
}
