import type { InvoiceType, InvoiceStatus, InvoiceTaxMode, InvoiceTaxBreakup, InvoiceReason } from "@/types/invoicing";

export interface EditorItemState {
  key: string;
  catalogRowId: string | null;
  productName: string;
  description: string;
  hsnSac: string;
  quantity: string;
  unit: string;
  rate: string;
  discountPercent: string;
  taxPercent: string;
}

export interface EditorFormState {
  type: InvoiceType;
  invoiceNumber: string;
  status: InvoiceStatus;

  invoiceDate: string;
  dueDate: string;
  currency: string;
  paymentTerms: string;
  referenceNumber: string;

  sellerName: string;
  sellerAddress: string;
  sellerTaxId: string;
  sellerPhone: string;
  sellerEmail: string;
  sellerLogoUrl: string;

  counterpartyUserId: string | null;
  partyName: string;
  partyContactPerson: string;
  partyEmail: string;
  partyPhone: string;
  partyBillingAddress: string;
  partyShippingAddress: string;
  partyTaxId: string;

  taxMode: InvoiceTaxMode;
  taxBreakup: InvoiceTaxBreakup;

  items: EditorItemState[];

  shippingCharge: string;
  miscCharge: string;
  miscChargeLabel: string;
  additionalDiscount: string;

  customerNotes: string;
  termsAndConditions: string;

  // Only relevant for CREDIT_NOTE / SALES_RETURN / DEBIT_NOTE.
  reason: InvoiceReason | "";
}

let keyCounter = 0;
export function newItemKey(): string {
  keyCounter += 1;
  return `item-${Date.now()}-${keyCounter}`;
}

export function emptyItem(): EditorItemState {
  return {
    key: newItemKey(),
    catalogRowId: null,
    productName: "",
    description: "",
    hsnSac: "",
    quantity: "1",
    unit: "pcs",
    rate: "0",
    discountPercent: "0",
    taxPercent: "0",
  };
}

export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISODate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
