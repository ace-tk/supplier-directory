import type {
  InvoiceType,
  InvoiceStatus,
  InvoiceTaxMode,
  InvoiceTaxBreakup,
  InvoiceReason,
  PaymentMethod,
  ChargeType,
  InvoiceTemplate,
} from "@/lib/generated/prisma/enums";

export type { InvoiceType, InvoiceStatus, InvoiceTaxMode, InvoiceTaxBreakup, InvoiceReason, PaymentMethod, ChargeType, InvoiceTemplate };

export interface InvoiceAdditionalChargeRecord {
  id: string;
  name: string;
  type: ChargeType;
  value: string;
  amount: string;
  order: number;
}

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

  shippingType: ChargeType;
  shippingValue: string;
  shippingCharge: string;
  additionalCharges: InvoiceAdditionalChargeRecord[];

  /** Deprecated — real for historical rows saved before Additional Charges existed; always 0/null on anything saved by current code. */
  miscCharge: string;
  miscChargeLabel: string | null;

  additionalDiscount: string;
  roundOff: string;
  grandTotal: string;

  customerNotes: string | null;
  termsAndConditions: string | null;

  // Optional — omitted from the preview/PDF entirely when every field is empty.
  bankAccountHolder: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankIfscCode: string | null;
  bankBranch: string | null;
  bankUpiId: string | null;
  bankPaymentInstructions: string | null;

  // Presentation only — which document design this invoice renders as.
  template: InvoiceTemplate;

  // Only set on CREDIT_NOTE / SALES_RETURN / DEBIT_NOTE documents.
  reason: InvoiceReason | null;

  // Generic "derived from" lineage — see lib/invoicing/family.ts for valid
  // (sourceType -> targetType) pairings.
  sourceInvoiceId: string | null;
  /** Source document's invoice number, for a display link — null if there's no source. */
  sourceInvoiceNumber: string | null;
  /** Only ever set on a QUOTATION that has been converted to a Tax Invoice. */
  convertedInvoice: { id: string; invoiceNumber: string } | null;

  archivedAt: string | null;

  items: InvoiceItemRecord[];

  createdAt: string;
  updatedAt: string;

  // Always derived from real Payment rows + dueDate at read time — never
  // stored. See lib/invoicing/payments.ts. Zero/false for document types
  // that don't accept payments (Quotation, Credit Note, Sales Return, Debit Note).
  amountPaid: string;
  balanceDue: string;
  isOverdue: boolean;
}

/** Lightweight shape for list/dashboard views — no line items or charge breakdown. */
export type InvoiceSummary = Omit<InvoiceRecord, "items" | "additionalCharges">;

export interface InvoiceListFilter {
  /** All document types to include — an InvoiceList shows a whole family (e.g. Tax Invoice + Quotation + Credit Note + Sales Return under Sales). */
  types: InvoiceType[];
  search?: string;
  status?: InvoiceStatus;
  dateFrom?: string;
  dateTo?: string;
  partyName?: string;
}

export interface SalesSummary {
  invoiced: string;
  received: string;
  outstanding: string;
  overdue: string;
  creditNotes: string;
  salesReturns: string;
}

export interface PurchaseSummary {
  purchased: string;
  paid: string;
  outstanding: string;
  debitNotes: string;
}

export interface ChartPoint {
  label: string;
  sales: string;
  purchases: string;
}

export interface PaymentChartPoint {
  label: string;
  received: string;
  paid: string;
}

export interface ExpenseCategoryPoint {
  category: string;
  amount: string;
}

export interface InvoiceDashboardStats {
  totalSales: string;
  totalPurchases: string;
  outstandingAmount: string;
  paidAmount: string;
  overdueCount: number;
  draftCount: number;
  recent: InvoiceSummary[];

  receivables: string;
  payables: string;
  overdueReceivable: string;
  overduePayable: string;
  totalExpenses: string;

  salesSummary: SalesSummary;
  purchaseSummary: PurchaseSummary;

  chartSalesVsPurchase: ChartPoint[];
  chartPaymentsOverTime: PaymentChartPoint[];
  chartExpensesByCategory: ExpenseCategoryPoint[];
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

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  amount: string;
  paymentDate: string;
  method: PaymentMethod;
  referenceNumber: string | null;
  notes: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
}

export interface RecordPaymentInput {
  amount: string;
  paymentDate: string;
  method: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
}

export interface InvoiceActivityRecord {
  id: string;
  invoiceId: string;
  type: string;
  description: string;
  actorName: string | null;
  createdAt: string;
}

export type InvoiceActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
