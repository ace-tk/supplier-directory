import { z } from "zod";

const INVOICE_TYPE_VALUES = ["SALES", "PURCHASE", "QUOTATION", "CREDIT_NOTE", "SALES_RETURN", "DEBIT_NOTE"] as const;
const REASON_VALUES = [
  "DAMAGED_GOODS",
  "PRICE_ADJUSTMENT",
  "PRODUCT_RETURN",
  "BILLING_ERROR",
  "DISCOUNT_ADJUSTMENT",
  "OTHER",
] as const;
const STATUS_VALUES = [
  "DRAFT",
  "SENT",
  "PENDING",
  "PARTIALLY_PAID",
  "PAID",
  "CANCELLED",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "CONVERTED",
  "ISSUED",
  "APPLIED",
] as const;
const TAX_MODE_VALUES = ["EXCLUSIVE", "INCLUSIVE"] as const;
const TAX_BREAKUP_VALUES = ["SINGLE", "CGST_SGST", "IGST"] as const;
const CHARGE_TYPE_VALUES = ["FIXED", "PERCENT"] as const;
const TEMPLATE_VALUES = ["REGULAR", "CLASSIC_RED", "MINIMAL_STUDIO"] as const;

/** Decimal-ish string: numeric, may be blank/omitted (defaults handled by calc engine). */
const moneyString = z
  .string()
  .trim()
  .refine((v) => v === "" || !Number.isNaN(Number(v)), "Must be a number")
  .optional();

export const additionalChargeInputSchema = z.object({
  name: z.string().min(1, "Charge name is required"),
  type: z.enum(CHARGE_TYPE_VALUES).default("FIXED"),
  value: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, "Must be 0 or more"),
});

export const invoiceItemInputSchema = z.object({
  catalogRowId: z.string().nullish(),
  productName: z.string().min(1, "Item name is required"),
  description: z.string().optional(),
  hsnSac: z.string().optional(),
  quantity: z
    .string()
    .trim()
    .refine((v) => Number(v) > 0, "Quantity must be greater than 0"),
  unit: z.string().min(1, "Unit is required").default("pcs"),
  rate: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, "Rate must be 0 or more"),
  discountPercent: moneyString,
  taxPercent: moneyString,
  order: z.number().default(0),
});

export const invoiceFormSchema = z
  .object({
    type: z.enum(INVOICE_TYPE_VALUES),
    invoiceNumber: z.string().min(1, "Invoice number is required"),
    status: z.enum(STATUS_VALUES).default("DRAFT"),

    invoiceDate: z.string().min(1, "Invoice date is required"),
    dueDate: z.string().min(1, "Due date is required"),
    currency: z.string().min(1, "Currency is required").default("INR"),
    paymentTerms: z.string().optional(),
    referenceNumber: z.string().optional(),

    sellerName: z.string().min(1, "Seller/company name is required"),
    sellerAddress: z.string().optional(),
    sellerTaxId: z.string().optional(),
    sellerPhone: z.string().optional(),
    sellerEmail: z.string().email().optional().or(z.literal("")),
    sellerLogoUrl: z.string().optional(),

    counterpartyUserId: z.string().nullish(),
    partyName: z.string().min(1, "Party name is required"),
    partyContactPerson: z.string().optional(),
    partyEmail: z.string().email().optional().or(z.literal("")),
    partyPhone: z.string().optional(),
    partyBillingAddress: z.string().optional(),
    partyShippingAddress: z.string().optional(),
    partyTaxId: z.string().optional(),

    taxMode: z.enum(TAX_MODE_VALUES).default("EXCLUSIVE"),
    taxBreakup: z.enum(TAX_BREAKUP_VALUES).default("SINGLE"),

    items: z.array(invoiceItemInputSchema).min(1, "Add at least one item"),

    shippingType: z.enum(CHARGE_TYPE_VALUES).default("FIXED"),
    shippingValue: moneyString,
    additionalCharges: z.array(additionalChargeInputSchema).default([]),
    additionalDiscount: moneyString,

    customerNotes: z.string().optional(),
    termsAndConditions: z.string().optional(),

    // Banking details — every field optional; the section is simply not
    // shown/persisted when nothing was entered (see buildInvoiceData).
    bankAccountHolder: z.string().optional(),
    bankName: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    bankIfscCode: z.string().optional(),
    bankBranch: z.string().optional(),
    bankUpiId: z.string().optional(),
    bankPaymentInstructions: z.string().optional(),

    template: z.enum(TEMPLATE_VALUES).default("REGULAR"),

    reason: z.enum(REASON_VALUES).optional(),
    sourceInvoiceId: z.string().nullish(),
  })
  .refine((d) => new Date(d.dueDate) >= new Date(d.invoiceDate), {
    message: "Due date must be on or after the invoice date",
    path: ["dueDate"],
  });

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;
export type InvoiceItemInputValues = z.infer<typeof invoiceItemInputSchema>;
