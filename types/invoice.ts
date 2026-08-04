import type { InvoiceStatus } from "@/lib/generated/prisma/enums";

export type { InvoiceStatus };

export interface PurchaseInvoiceRecord {
  id: string;
  vendor: string;
  poNumber: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  gst: number;
  shipping: number;
  totalAmount: number;
  status: InvoiceStatus;
  notes: string | null;
  attachmentFileName: string | null;
  attachmentDataUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalesInvoiceItemEntry {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  order: number;
}

export interface SalesInvoiceRecord {
  id: string;
  customer: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  items: SalesInvoiceItemEntry[];
  gst: number;
  shipping: number;
  grandTotal: number;
  paymentStatus: InvoiceStatus;
  notes: string | null;
  attachmentFileName: string | null;
  attachmentDataUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
