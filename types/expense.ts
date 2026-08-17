import type { ExpenseCategory, PaymentMethod } from "@/lib/generated/prisma/enums";
import type { InvoiceTemplate } from "@/types/invoicing";

export type { ExpenseCategory, PaymentMethod };

export interface ExpenseRecord {
  id: string;
  ownerId: string;

  occurredAt: string;
  location: string | null;
  locationLat: number | null;
  locationLng: number | null;
  category: ExpenseCategory;
  customCategoryLabel: string | null;
  customCategoryId: string | null;
  amount: string;
  currency: string;
  notes: string | null;

  gstNumber: string | null;
  gstPercent: number | null;
  paymentMethod: PaymentMethod | null;
  department: string | null;
  expenseType: string | null;

  // Legacy generic party/invoice link — kept for rows written before the
  // buyer/supplier split below existed.
  partyUserId: string | null;
  partyName: string | null;

  relatedInvoiceId: string | null;
  relatedInvoiceNumber: string | null;
  relatedInvoiceDate: string | null;
  relatedInvoiceAmount: string | null;

  buyerUserId: string | null;
  buyerName: string | null;
  supplierUserId: string | null;
  supplierName: string | null;

  relatedPurchaseInvoiceId: string | null;
  relatedPurchaseInvoiceNumber: string | null;
  relatedPurchaseInvoiceDate: string | null;
  relatedPurchaseInvoiceAmount: string | null;

  manualPartyName: string | null;

  contactId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  manualContactName: string | null;
  manualContactPhone: string | null;
  manualContactCountryCode: string | null;

  paymentAccountId: string | null;
  paymentAccountLabel: string | null;
  paymentAccountProvider: string | null;
  paymentAccountLast4: string | null;
  referenceNumber: string | null;

  createVoucher: boolean;
  voucherTemplate: InvoiceTemplate | null;

  attachmentFileName: string | null;
  attachmentUrl: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface ExpenseListFilter {
  search?: string;
  category?: ExpenseCategory;
  dateFrom?: string;
  dateTo?: string;
  partyUserId?: string;
}

export interface ExpenseCustomCategoryOption {
  id: string;
  name: string;
}

export interface ExpenseFormInput {
  occurredAt: string;
  location?: string;
  locationLat?: number | null;
  locationLng?: number | null;
  category: ExpenseCategory;
  customCategoryLabel?: string;
  customCategoryId?: string | null;
  amount: string;
  currency: string;
  notes?: string;
  gstNumber?: string;
  gstPercent?: number | null;
  paymentMethod?: PaymentMethod | null;
  department?: string;
  expenseType?: string;
  partyUserId?: string | null;
  relatedInvoiceId?: string | null;
  buyerUserId?: string | null;
  supplierUserId?: string | null;
  relatedPurchaseInvoiceId?: string | null;
  manualPartyName?: string;
  contactId?: string | null;
  manualContactName?: string;
  manualContactPhone?: string;
  manualContactCountryCode?: string;
  paymentAccountId?: string | null;
  referenceNumber?: string;
  createVoucher?: boolean;
  voucherTemplate?: InvoiceTemplate | null;
  attachmentFileName?: string;
  attachmentUrl?: string;
}

export interface InvoiceOption {
  id: string;
  invoiceNumber: string;
  partyName: string;
}

/** A Buyer- or Supplier-linked document shown under the party picker
 * ("Linked Invoices" / "Related Purchases"). */
export interface PartyInvoiceOption {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  grandTotal: string;
  currency: string;
  partyTaxId: string | null;
}

export interface ExpenseContactOption {
  id: string;
  partyUserId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  countryCode: string | null;
}

export interface PaymentAccountOption {
  id: string;
  label: string;
  type: PaymentMethod;
  provider: string | null;
  last4: string | null;
}

export type ExpenseActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
