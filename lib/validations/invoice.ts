import { z } from "zod";

const STATUS_VALUES = ["DRAFT", "SENT", "PAID", "PENDING", "OVERDUE"] as const;

export const purchaseInvoiceSchema = z
  .object({
    id: z.string().optional(),
    vendor: z.string().min(1, "Vendor is required"),
    poNumber: z.string().optional(),
    invoiceNumber: z.string().min(1, "Invoice number is required"),
    invoiceDate: z.string().min(1, "Invoice date is required"),
    dueDate: z.string().min(1, "Due date is required"),
    gst: z.coerce.number().min(0).default(0),
    shipping: z.coerce.number().min(0).default(0),
    totalAmount: z.coerce.number().min(0).default(0),
    status: z.enum(STATUS_VALUES).default("DRAFT"),
    notes: z.string().optional(),
    attachmentFileName: z.string().optional(),
    attachmentDataUrl: z.string().optional(),
  })
  .refine((d) => new Date(d.dueDate) >= new Date(d.invoiceDate), {
    message: "Due date must be on or after the invoice date",
    path: ["dueDate"],
  });

export const salesInvoiceItemSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  unitPrice: z.coerce.number().min(0, "Must be 0 or more"),
});

export const salesInvoiceSchema = z
  .object({
    id: z.string().optional(),
    customer: z.string().min(1, "Customer is required"),
    invoiceNumber: z.string().min(1, "Invoice number is required"),
    invoiceDate: z.string().min(1, "Invoice date is required"),
    dueDate: z.string().min(1, "Due date is required"),
    items: z.array(salesInvoiceItemSchema).default([]),
    gst: z.coerce.number().min(0).default(0),
    shipping: z.coerce.number().min(0).default(0),
    paymentStatus: z.enum(STATUS_VALUES).default("DRAFT"),
    notes: z.string().optional(),
    attachmentFileName: z.string().optional(),
    attachmentDataUrl: z.string().optional(),
  })
  .refine((d) => new Date(d.dueDate) >= new Date(d.invoiceDate), {
    message: "Due date must be on or after the invoice date",
    path: ["dueDate"],
  });

export type PurchaseInvoiceInput = z.infer<typeof purchaseInvoiceSchema>;
export type SalesInvoiceInput = z.infer<typeof salesInvoiceSchema>;
