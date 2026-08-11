// Real, DB-backed reporting layer — one query per report kind, all scoped
// per owner, all reading straight from the persisted Invoice/Payment/Expense
// tables (never mock data). Every report returns the same generic
// {columns, rows} shape so a single table renderer and a single CSV
// exporter can serve all of them.

import { db } from "@/lib/db";
import { derivePaymentFields } from "@/lib/invoicing/queries";
import { INVOICE_TYPE_LABELS, INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS, formatMoney, formatShortDate } from "@/lib/invoicing/ui";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/expenses/ui";
import type { InvoiceType } from "@/types/invoicing";
import type { ExpenseCategory } from "@/types/expense";
import type { ReportKind, ReportFilter, ReportResult } from "@/lib/invoicing/reports-types";

function dateWindow(filter: ReportFilter) {
  if (!filter.dateFrom && !filter.dateTo) return undefined;
  return {
    ...(filter.dateFrom ? { gte: new Date(filter.dateFrom) } : {}),
    ...(filter.dateTo ? { lte: new Date(filter.dateTo) } : {}),
  };
}

const invoiceRowInclude = { payments: { select: { amount: true } } } as const;

async function invoiceReportRows(
  ownerId: string,
  types: InvoiceType[],
  filter: ReportFilter,
  onlyOutstanding: boolean
) {
  const window = dateWindow(filter);
  // documentType isn't applied here — these report kinds are each already
  // scoped to a single document type (Sales/Purchase/Receivables/Payables),
  // so letting it override `types` could silently show the wrong family.
  const rows = await db.invoice.findMany({
    where: {
      ownerId,
      archivedAt: null,
      type: { in: types },
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.partyName ? { partyName: { contains: filter.partyName, mode: "insensitive" as const } } : {}),
      ...(window ? { invoiceDate: window } : {}),
    },
    include: invoiceRowInclude,
    orderBy: { invoiceDate: "desc" },
  });

  const mapped = rows.map((inv) => {
    const { amountPaid, balanceDue, isOverdue } = derivePaymentFields(inv);
    return { inv, amountPaid, balanceDue, isOverdue };
  });

  return onlyOutstanding ? mapped.filter((r) => Number(r.balanceDue) > 0) : mapped;
}

async function getSalesOrPurchaseReport(ownerId: string, family: "SALES" | "PURCHASE", filter: ReportFilter): Promise<ReportResult> {
  const rows = await invoiceReportRows(ownerId, [family], filter, false);
  return {
    columns: [
      { key: "invoiceNumber", label: "Invoice #" },
      { key: "party", label: family === "SALES" ? "Buyer" : "Supplier" },
      { key: "invoiceDate", label: "Invoice Date" },
      { key: "dueDate", label: "Due Date" },
      { key: "status", label: "Status" },
      { key: "grandTotal", label: "Amount", align: "right" },
      { key: "amountPaid", label: "Amount Paid", align: "right" },
      { key: "balanceDue", label: "Balance Due", align: "right" },
    ],
    rows: rows.map(({ inv, amountPaid, balanceDue }) => ({
      invoiceNumber: inv.invoiceNumber,
      party: inv.partyName,
      invoiceDate: formatShortDate(inv.invoiceDate.toISOString()),
      dueDate: formatShortDate(inv.dueDate.toISOString()),
      status: INVOICE_STATUS_LABELS[inv.status],
      grandTotal: formatMoney(inv.grandTotal.toString(), inv.currency),
      amountPaid: formatMoney(amountPaid, inv.currency),
      balanceDue: formatMoney(balanceDue, inv.currency),
    })),
  };
}

async function getReceivablesOrPayablesReport(ownerId: string, family: "SALES" | "PURCHASE", filter: ReportFilter): Promise<ReportResult> {
  const rows = await invoiceReportRows(ownerId, [family], filter, true);
  return {
    columns: [
      { key: "invoiceNumber", label: "Invoice #" },
      { key: "party", label: family === "SALES" ? "Buyer" : "Supplier" },
      { key: "dueDate", label: "Due Date" },
      { key: "overdue", label: "Overdue?" },
      { key: "grandTotal", label: "Amount", align: "right" },
      { key: "balanceDue", label: "Balance Due", align: "right" },
    ],
    rows: rows.map(({ inv, balanceDue, isOverdue }) => ({
      invoiceNumber: inv.invoiceNumber,
      party: inv.partyName,
      dueDate: formatShortDate(inv.dueDate.toISOString()),
      overdue: isOverdue ? "Yes" : "No",
      grandTotal: formatMoney(inv.grandTotal.toString(), inv.currency),
      balanceDue: formatMoney(balanceDue, inv.currency),
    })),
  };
}

/** Per-invoice taxable amount + GST breakup. A raw breakdown for the filtered range — explicitly not a GST filing document. */
async function getGstSummaryReport(ownerId: string, filter: ReportFilter): Promise<ReportResult> {
  const window = dateWindow(filter);
  const rows = await db.invoice.findMany({
    where: {
      ownerId,
      archivedAt: null,
      type: filter.documentType ? filter.documentType : { in: ["SALES", "PURCHASE"] },
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.partyName ? { partyName: { contains: filter.partyName, mode: "insensitive" as const } } : {}),
      ...(window ? { invoiceDate: window } : {}),
    },
    orderBy: { invoiceDate: "desc" },
  });

  return {
    columns: [
      { key: "invoiceNumber", label: "Invoice #" },
      { key: "type", label: "Type" },
      { key: "party", label: "Party" },
      { key: "invoiceDate", label: "Invoice Date" },
      { key: "taxableAmount", label: "Taxable Amount", align: "right" },
      { key: "cgst", label: "CGST", align: "right" },
      { key: "sgst", label: "SGST", align: "right" },
      { key: "igst", label: "IGST", align: "right" },
      { key: "totalTax", label: "Total GST", align: "right" },
    ],
    rows: rows.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      type: INVOICE_TYPE_LABELS[inv.type],
      party: inv.partyName,
      invoiceDate: formatShortDate(inv.invoiceDate.toISOString()),
      taxableAmount: formatMoney(inv.taxableAmount.toString(), inv.currency),
      cgst: formatMoney(inv.cgstTotal.toString(), inv.currency),
      sgst: formatMoney(inv.sgstTotal.toString(), inv.currency),
      igst: formatMoney(inv.igstTotal.toString(), inv.currency),
      totalTax: formatMoney(inv.taxTotal.toString(), inv.currency),
    })),
  };
}

async function getExpenseReport(ownerId: string, filter: ReportFilter): Promise<ReportResult> {
  const window = dateWindow(filter);
  const rows = await db.expense.findMany({
    where: {
      ownerId,
      ...(window ? { occurredAt: window } : {}),
      ...(filter.partyName ? { partyUser: { name: { contains: filter.partyName, mode: "insensitive" as const } } } : {}),
    },
    include: { relatedInvoice: { select: { invoiceNumber: true } } },
    orderBy: { occurredAt: "desc" },
  });

  return {
    columns: [
      { key: "date", label: "Date" },
      { key: "category", label: "Category" },
      { key: "location", label: "Location" },
      { key: "relatedInvoice", label: "Related Invoice" },
      { key: "amount", label: "Amount", align: "right" },
    ],
    rows: rows.map((e) => ({
      date: formatShortDate(e.occurredAt.toISOString()),
      category: EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory] ?? e.category,
      location: e.location ?? "—",
      relatedInvoice: e.relatedInvoice?.invoiceNumber ?? "—",
      amount: formatMoney(e.amount.toString(), e.currency),
    })),
  };
}

async function getPaymentReport(ownerId: string, filter: ReportFilter): Promise<ReportResult> {
  const window = dateWindow(filter);
  const rows = await db.payment.findMany({
    where: {
      invoice: {
        ownerId,
        ...(filter.documentType ? { type: filter.documentType } : {}),
        ...(filter.partyName ? { partyName: { contains: filter.partyName, mode: "insensitive" as const } } : {}),
      },
      ...(window ? { paymentDate: window } : {}),
    },
    include: { invoice: { select: { invoiceNumber: true, partyName: true, type: true, currency: true } }, createdBy: { select: { name: true, email: true } } },
    orderBy: { paymentDate: "desc" },
  });

  return {
    columns: [
      { key: "date", label: "Date" },
      { key: "invoiceNumber", label: "Invoice #" },
      { key: "party", label: "Party" },
      { key: "type", label: "Direction" },
      { key: "method", label: "Method" },
      { key: "recordedBy", label: "Recorded By" },
      { key: "amount", label: "Amount", align: "right" },
    ],
    rows: rows.map((p) => ({
      date: formatShortDate(p.paymentDate.toISOString()),
      invoiceNumber: p.invoice.invoiceNumber,
      party: p.invoice.partyName,
      type: p.invoice.type === "SALES" ? "Received" : "Paid",
      method: PAYMENT_METHOD_LABELS[p.method],
      recordedBy: p.createdBy.name || p.createdBy.email || "Unknown",
      amount: formatMoney(p.amount.toString(), p.invoice.currency),
    })),
  };
}

export async function getReportRows(ownerId: string, kind: ReportKind, filter: ReportFilter): Promise<ReportResult> {
  switch (kind) {
    case "SALES":
      return getSalesOrPurchaseReport(ownerId, "SALES", filter);
    case "PURCHASE":
      return getSalesOrPurchaseReport(ownerId, "PURCHASE", filter);
    case "RECEIVABLES":
      return getReceivablesOrPayablesReport(ownerId, "SALES", filter);
    case "PAYABLES":
      return getReceivablesOrPayablesReport(ownerId, "PURCHASE", filter);
    case "GST_SUMMARY":
      return getGstSummaryReport(ownerId, filter);
    case "EXPENSE":
      return getExpenseReport(ownerId, filter);
    case "PAYMENT":
      return getPaymentReport(ownerId, filter);
  }
}
