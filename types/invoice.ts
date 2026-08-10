// NOTE: this file is orphaned Phase-1 legacy — kept only so lib/invoice-pdf.ts
// (unused until Phase 2 wires up PDF export against the new Invoice model)
// keeps compiling. The live status enum now lives in types/invoicing.ts.
export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "PENDING" | "OVERDUE";

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
