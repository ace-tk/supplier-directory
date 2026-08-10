import type {
  InvoiceType,
  InvoiceStatus,
  InvoiceTaxMode,
  InvoiceTaxBreakup,
  InvoiceReason,
} from "@/lib/generated/prisma/enums";

export type { InvoiceType, InvoiceStatus, InvoiceTaxMode, InvoiceTaxBreakup, InvoiceReason };

export interface InvoiceItemRecord {
  id: string;
  catalogRowId: string | null;
  productName: string;
  description: string | null;
  hsnSac: string | null;
  quantity: string;
  unit: string;
  rate: string;
  discountPercent: string;
  discountAmount: string;
  taxPercent: string;
  taxAmount: string;
  lineTotal: string;
  order: number;
}

export interface InvoiceRecord {
  id: string;
  type: InvoiceType;
  ownerId: string;
  counterpartyUserId: string | null;

  invoiceNumber: string;
  status: InvoiceStatus;

  invoiceDate: string;
  dueDate: string;
  currency: string;
  paymentTerms: string | null;
  referenceNumber: string | null;

  sellerName: string;
  sellerAddress: string | null;
  sellerTaxId: string | null;
  sellerPhone: string | null;
  sellerEmail: string | null;
  sellerLogoUrl: string | null;

  partyName: string;
  partyContactPerson: string | null;
  partyEmail: string | null;
  partyPhone: string | null;
  partyBillingAddress: string | null;
  partyShippingAddress: string | null;
  partyTaxId: string | null;

  taxMode: InvoiceTaxMode;
  taxBreakup: InvoiceTaxBreakup;

  subtotal: string;
  itemDiscountTotal: string;
  taxableAmount: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  taxTotal: string;
  shippingCharge: string;
  miscCharge: string;
  miscChargeLabel: string | null;
  additionalDiscount: string;
  roundOff: string;
  grandTotal: string;

  customerNotes: string | null;
  termsAndConditions: string | null;

  // Only set on CREDIT_NOTE / SALES_RETURN / DEBIT_NOTE documents.
  reason: InvoiceReason | null;

  // Generic "derived from" lineage — see lib/invoicing/family.ts for valid
  // (sourceType -> targetType) pairings.
  sourceInvoiceId: string | null;

  archivedAt: string | null;

  items: InvoiceItemRecord[];

  createdAt: string;
  updatedAt: string;
}

/** Lightweight shape for list/dashboard views — no line items. */
export type InvoiceSummary = Omit<InvoiceRecord, "items">;

export interface InvoiceListFilter {
  /** All document types to include — an InvoiceList shows a whole family (e.g. Tax Invoice + Quotation + Credit Note + Sales Return under Sales). */
  types: InvoiceType[];
  search?: string;
  status?: InvoiceStatus;
  dateFrom?: string;
  dateTo?: string;
  partyName?: string;
}

export interface InvoiceDashboardStats {
  totalSales: string;
  totalPurchases: string;
  outstandingAmount: string;
  paidAmount: string;
  overdueCount: number;
  draftCount: number;
  recent: InvoiceSummary[];
}

export interface DirectoryOption {
  id: string;
  name: string;
  companyName: string;
  email: string;
}

export interface CatalogRowOption {
  id: string;
  productName: string;
  description: string | null;
  sku: string | null;
  hsnCode: string | null;
  imageUrl: string | null;
  quantity: number;
  gstPercent: number;
  priceBeforeGst: number;
  priceAfterGst: number;
  currency: string;
}

/** Raw item shape submitted from the editor form, before server recalculation. */
export interface InvoiceItemInput {
  catalogRowId?: string | null;
  productName: string;
  description?: string;
  hsnSac?: string;
  quantity: string;
  unit: string;
  rate: string;
  discountPercent?: string;
  taxPercent?: string;
  order: number;
}

/** Full payload submitted from the editor form on save. */
export interface InvoiceFormInput {
  type: InvoiceType;
  invoiceNumber: string;
  status: InvoiceStatus;

  invoiceDate: string;
  dueDate: string;
  currency: string;
  paymentTerms?: string;
  referenceNumber?: string;

  sellerName: string;
  sellerAddress?: string;
  sellerTaxId?: string;
  sellerPhone?: string;
  sellerEmail?: string;
  sellerLogoUrl?: string;

  counterpartyUserId?: string | null;
  partyName: string;
  partyContactPerson?: string;
  partyEmail?: string;
  partyPhone?: string;
  partyBillingAddress?: string;
  partyShippingAddress?: string;
  partyTaxId?: string;

  taxMode: InvoiceTaxMode;
  taxBreakup: InvoiceTaxBreakup;

  items: InvoiceItemInput[];

  shippingCharge?: string;
  miscCharge?: string;
  miscChargeLabel?: string;
  additionalDiscount?: string;

  customerNotes?: string;
  termsAndConditions?: string;

  reason?: InvoiceReason;
  sourceInvoiceId?: string | null;
}

export interface RelatedDocuments {
  source: InvoiceSummary | null;
  derived: InvoiceSummary[];
}

export type InvoiceActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
