import type { ExpenseCategory } from "@/lib/generated/prisma/enums";

export type { ExpenseCategory };

export interface ExpenseRecord {
  id: string;
  ownerId: string;

  occurredAt: string;
  location: string | null;
  category: ExpenseCategory;
  customCategoryLabel: string | null;
  amount: string;
  currency: string;
  notes: string | null;

  partyUserId: string | null;
  partyName: string | null;

  relatedInvoiceId: string | null;
  relatedInvoiceNumber: string | null;

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

export interface ExpenseFormInput {
  occurredAt: string;
  location?: string;
  category: ExpenseCategory;
  customCategoryLabel?: string;
  amount: string;
  currency: string;
  notes?: string;
  partyUserId?: string | null;
  relatedInvoiceId?: string | null;
  attachmentFileName?: string;
  attachmentUrl?: string;
}

export interface InvoiceOption {
  id: string;
  invoiceNumber: string;
  partyName: string;
}

export type ExpenseActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
