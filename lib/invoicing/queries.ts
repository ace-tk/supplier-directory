// Real, DB-backed read layer for Invoice Management — scoped per owner
// across all four portals. Decimal fields are always converted to plain
// strings here, before crossing into any client component.

import Decimal from "decimal.js";
import { format, eachDayOfInterval, eachMonthOfInterval } from "date-fns";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { computeInvoicePaymentSummary, isInvoiceOverdue } from "@/lib/invoicing/payments";
import { resolvePeriodRange, chartBucketGranularity, type DashboardPeriod } from "@/lib/invoicing/period";
import type {
  InvoiceRecord,
  InvoiceItemRecord,
  InvoiceSummary,
  InvoiceListFilter,
  InvoiceDashboardStats,
  RelatedDocuments,
  InvoiceType,
  InvoiceStatus,
  InvoiceActivityRecord,
} from "@/types/invoicing";

function dec(value: { toString(): string } | null | undefined): string {
  return value == null ? "0" : value.toString();
}

// Only SALES/PURCHASE documents accept payments (see services/payments.ts)
// — every other document type has no balance/overdue concept.
const PAYABLE_TYPES: InvoiceType[] = ["SALES", "PURCHASE"];

// NOTE: name predates the sourceInvoice/derivedDocuments additions below —
// kept as-is (renaming would touch every call site) but now covers more
// than just payments: it's the shared "summary row" include used by every
// list/detail read path.
const paymentsInclude = {
  payments: { select: { amount: true } },
  // Cheap to-one relation — powers the "Source Invoice" column on the
  // Credit Note/Sales Return/Debit Note list views.
  sourceInvoice: { select: { invoiceNumber: true } },
  // Only ever non-empty for a QUOTATION that has been converted — powers
  // the "Converted Invoice" column on the Quotations list. Harmless empty
  // array for every other document type.
  derivedDocuments: { where: { type: "SALES" as const }, select: { id: true, invoiceNumber: true }, take: 1 },
} as const;
const itemsInclude = {
  items: { orderBy: { order: "asc" as const } },
  additionalCharges: { orderBy: { order: "asc" as const } },
  ...paymentsInclude,
};

type InvoiceRow = NonNullable<Awaited<ReturnType<typeof fetchInvoiceRaw>>>;
type InvoiceItemRow = InvoiceRow["items"][number];
type InvoiceAdditionalChargeRow = InvoiceRow["additionalCharges"][number];
type InvoiceSummaryRow = Awaited<ReturnType<typeof fetchSummaryRowsRaw>>[number];

function fetchInvoiceRaw(id: string) {
  return db.invoice.findUnique({ where: { id }, include: itemsInclude });
}

function fetchSummaryRowsRaw(where: Prisma.InvoiceWhereInput) {
  return db.invoice.findMany({ where, include: paymentsInclude, orderBy: { invoiceDate: "desc" } });
}

function mapItem(item: InvoiceItemRow): InvoiceItemRecord {
  return {
    id: item.id,
    catalogRowId: item.catalogRowId,
    productName: item.productName,
    description: item.description,
    hsnSac: item.hsnSac,
    quantity: dec(item.quantity),
    unit: item.unit,
    rate: dec(item.rate),
    discountPercent: dec(item.discountPercent),
    discountAmount: dec(item.discountAmount),
    taxPercent: dec(item.taxPercent),
    taxAmount: dec(item.taxAmount),
    lineTotal: dec(item.lineTotal),
    order: item.order,
  };
}

function mapAdditionalCharge(charge: InvoiceAdditionalChargeRow) {
  return {
    id: charge.id,
    name: charge.name,
    type: charge.type,
    value: dec(charge.value),
    amount: dec(charge.amount),
    order: charge.order,
  };
}

/** amountPaid/balanceDue/isOverdue are always derived here, never trusted from a stored column. */
export function derivePaymentFields(inv: {
  type: InvoiceType;
  status: InvoiceStatus;
  dueDate: Date;
  grandTotal: { toString(): string } | null;
  payments: { amount: { toString(): string } | null }[];
}) {
  const grandTotal = dec(inv.grandTotal);
  if (!PAYABLE_TYPES.includes(inv.type)) {
    return { amountPaid: "0.00", balanceDue: dec(inv.grandTotal), isOverdue: false };
  }
  const summary = computeInvoicePaymentSummary(
    grandTotal,
    inv.payments.map((p) => ({ amount: dec(p.amount) }))
  );
  return {
    amountPaid: summary.amountPaid,
    balanceDue: summary.balanceDue,
    isOverdue: isInvoiceOverdue(inv.dueDate, summary.balanceDue, inv.status),
  };
}

function mapSummary(inv: InvoiceSummaryRow): InvoiceSummary {
  return {
    id: inv.id,
    type: inv.type,
    ownerId: inv.ownerId,
    counterpartyUserId: inv.counterpartyUserId,

    invoiceNumber: inv.invoiceNumber,
    status: inv.status,

    invoiceDate: inv.invoiceDate.toISOString(),
    dueDate: inv.dueDate.toISOString(),
    currency: inv.currency,
    paymentTerms: inv.paymentTerms,
    referenceNumber: inv.referenceNumber,

    sellerName: inv.sellerName,
    sellerAddress: inv.sellerAddress,
    sellerTaxId: inv.sellerTaxId,
    sellerPhone: inv.sellerPhone,
    sellerEmail: inv.sellerEmail,
    sellerLogoUrl: inv.sellerLogoUrl,

    partyName: inv.partyName,
    partyContactPerson: inv.partyContactPerson,
    partyEmail: inv.partyEmail,
    partyPhone: inv.partyPhone,
    partyBillingAddress: inv.partyBillingAddress,
    partyShippingAddress: inv.partyShippingAddress,
    partyTaxId: inv.partyTaxId,

    taxMode: inv.taxMode,
    taxBreakup: inv.taxBreakup,

    subtotal: dec(inv.subtotal),
    itemDiscountTotal: dec(inv.itemDiscountTotal),
    taxableAmount: dec(inv.taxableAmount),
    cgstTotal: dec(inv.cgstTotal),
    sgstTotal: dec(inv.sgstTotal),
    igstTotal: dec(inv.igstTotal),
    taxTotal: dec(inv.taxTotal),

    shippingType: inv.shippingType,
    shippingValue: dec(inv.shippingValue),
    shippingCharge: dec(inv.shippingCharge),

    miscCharge: dec(inv.miscCharge),
    miscChargeLabel: inv.miscChargeLabel,
    additionalDiscount: dec(inv.additionalDiscount),
    roundOff: dec(inv.roundOff),
    grandTotal: dec(inv.grandTotal),

    customerNotes: inv.customerNotes,
    termsAndConditions: inv.termsAndConditions,

    bankAccountHolder: inv.bankAccountHolder,
    bankName: inv.bankName,
    bankAccountNumber: inv.bankAccountNumber,
    bankIfscCode: inv.bankIfscCode,
    bankBranch: inv.bankBranch,
    bankUpiId: inv.bankUpiId,
    bankPaymentInstructions: inv.bankPaymentInstructions,

    reason: inv.reason,
    sourceInvoiceId: inv.sourceInvoiceId,
    sourceInvoiceNumber: inv.sourceInvoice?.invoiceNumber ?? null,
    convertedInvoice: inv.derivedDocuments[0]
      ? { id: inv.derivedDocuments[0].id, invoiceNumber: inv.derivedDocuments[0].invoiceNumber }
      : null,

    archivedAt: inv.archivedAt ? inv.archivedAt.toISOString() : null,

    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),

    ...derivePaymentFields(inv),
  };
}

function mapInvoice(inv: InvoiceRow): InvoiceRecord {
  return { ...mapSummary(inv), items: inv.items.map(mapItem), additionalCharges: inv.additionalCharges.map(mapAdditionalCharge) };
}

export async function getInvoiceById(id: string): Promise<InvoiceRecord | null> {
  const row = await fetchInvoiceRaw(id);
  return row ? mapInvoice(row) : null;
}

export async function listInvoicesForOwner(
  ownerId: string,
  filter: InvoiceListFilter
): Promise<InvoiceSummary[]> {
  const rows = await fetchSummaryRowsRaw({
    ownerId,
    type: { in: filter.types },
    archivedAt: null,
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.dateFrom || filter.dateTo
      ? {
          invoiceDate: {
            ...(filter.dateFrom ? { gte: new Date(filter.dateFrom) } : {}),
            ...(filter.dateTo ? { lte: new Date(filter.dateTo) } : {}),
          },
        }
      : {}),
    ...(filter.partyName ? { partyName: { contains: filter.partyName, mode: "insensitive" as const } } : {}),
    ...(filter.search
      ? {
          OR: [
            { invoiceNumber: { contains: filter.search, mode: "insensitive" as const } },
            { partyName: { contains: filter.search, mode: "insensitive" as const } },
            { sellerName: { contains: filter.search, mode: "insensitive" as const } },
            { items: { some: { productName: { contains: filter.search, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  });
  return rows.map(mapSummary);
}

export async function getRelatedDocuments(invoiceId: string): Promise<RelatedDocuments> {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    select: { sourceInvoiceId: true },
  });
  if (!invoice) return { source: null, derived: [] };

  const [sourceRow, derivedRows] = await Promise.all([
    invoice.sourceInvoiceId ? db.invoice.findUnique({ where: { id: invoice.sourceInvoiceId }, include: paymentsInclude }) : null,
    db.invoice.findMany({ where: { sourceInvoiceId: invoiceId }, include: paymentsInclude, orderBy: { createdAt: "desc" } }),
  ]);

  return {
    source: sourceRow ? mapSummary(sourceRow) : null,
    derived: derivedRows.map(mapSummary),
  };
}

export async function getInvoiceActivity(invoiceId: string): Promise<InvoiceActivityRecord[]> {
  const rows = await db.invoiceActivity.findMany({
    where: { invoiceId },
    include: { actor: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    invoiceId: r.invoiceId,
    type: r.type,
    description: r.description,
    actorName: r.actor ? r.actor.name || r.actor.email : null,
    createdAt: r.createdAt.toISOString(),
  }));
}

function bucketKeyAndLabel(date: Date, granularity: "day" | "month"): { key: string; label: string } {
  return granularity === "day"
    ? { key: format(date, "yyyy-MM-dd"), label: format(date, "MMM d") }
    : { key: format(date, "yyyy-MM"), label: format(date, "MMM yyyy") };
}

export async function getDashboardStatsForOwner(ownerId: string, period: DashboardPeriod = "THIS_MONTH"): Promise<InvoiceDashboardStats> {
  const { from, to } = resolvePeriodRange(period);
  const dateWindow = { gte: from, lte: to };
  const granularity = chartBucketGranularity(from, to);
  const buckets = granularity === "day" ? eachDayOfInterval({ start: from, end: to }) : eachMonthOfInterval({ start: from, end: to });

  const [periodInvoices, expensesAgg, expensesByCategory, periodPayments, draftCount, recentRows] = await Promise.all([
    db.invoice.findMany({
      where: { ownerId, archivedAt: null, invoiceDate: dateWindow },
      select: { type: true, status: true, dueDate: true, invoiceDate: true, grandTotal: true, payments: { select: { amount: true } } },
    }),
    db.expense.aggregate({ where: { ownerId, occurredAt: dateWindow }, _sum: { amount: true } }),
    db.expense.groupBy({ by: ["category"], where: { ownerId, occurredAt: dateWindow }, _sum: { amount: true } }),
    db.payment.findMany({
      where: { invoice: { ownerId }, paymentDate: dateWindow },
      select: { amount: true, paymentDate: true, invoice: { select: { type: true } } },
    }),
    db.invoice.count({ where: { ownerId, archivedAt: null, status: "DRAFT" } }),
    db.invoice.findMany({
      where: { ownerId, archivedAt: null },
      include: paymentsInclude,
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  let totalSales = new Decimal(0);
  let totalPurchases = new Decimal(0);
  let salesOutstanding = new Decimal(0);
  let salesOverdue = new Decimal(0);
  let purchaseOutstanding = new Decimal(0);
  let purchaseOverdue = new Decimal(0);
  let creditNotes = new Decimal(0);
  let salesReturns = new Decimal(0);
  let debitNotes = new Decimal(0);
  let overdueCount = 0;
  let paidAmount = new Decimal(0);

  const salesByBucket = new Map<string, Decimal>();
  const purchasesByBucket = new Map<string, Decimal>();

  for (const inv of periodInvoices) {
    const grandTotal = dec(inv.grandTotal);
    const { balanceDue, amountPaid, isOverdue } = derivePaymentFields(inv);

    if (inv.type === "SALES") {
      totalSales = totalSales.plus(grandTotal);
      salesOutstanding = salesOutstanding.plus(balanceDue);
      if (isOverdue) salesOverdue = salesOverdue.plus(balanceDue);
      const { key } = bucketKeyAndLabel(inv.invoiceDate, granularity);
      salesByBucket.set(key, (salesByBucket.get(key) ?? new Decimal(0)).plus(grandTotal));
    } else if (inv.type === "PURCHASE") {
      totalPurchases = totalPurchases.plus(grandTotal);
      purchaseOutstanding = purchaseOutstanding.plus(balanceDue);
      if (isOverdue) purchaseOverdue = purchaseOverdue.plus(balanceDue);
      const { key } = bucketKeyAndLabel(inv.invoiceDate, granularity);
      purchasesByBucket.set(key, (purchasesByBucket.get(key) ?? new Decimal(0)).plus(grandTotal));
    } else if (inv.type === "CREDIT_NOTE") {
      creditNotes = creditNotes.plus(grandTotal);
    } else if (inv.type === "SALES_RETURN") {
      salesReturns = salesReturns.plus(grandTotal);
    } else if (inv.type === "DEBIT_NOTE") {
      debitNotes = debitNotes.plus(grandTotal);
    }

    if (PAYABLE_TYPES.includes(inv.type)) {
      paidAmount = paidAmount.plus(amountPaid);
      if (isOverdue) overdueCount += 1;
    }
  }

  let received = new Decimal(0);
  let paid = new Decimal(0);
  const receivedByBucket = new Map<string, Decimal>();
  const paidByBucket = new Map<string, Decimal>();
  for (const p of periodPayments) {
    const amount = dec(p.amount);
    const { key } = bucketKeyAndLabel(p.paymentDate, granularity);
    if (p.invoice.type === "SALES") {
      received = received.plus(amount);
      receivedByBucket.set(key, (receivedByBucket.get(key) ?? new Decimal(0)).plus(amount));
    } else if (p.invoice.type === "PURCHASE") {
      paid = paid.plus(amount);
      paidByBucket.set(key, (paidByBucket.get(key) ?? new Decimal(0)).plus(amount));
    }
  }

  const chartSalesVsPurchase = buckets.map((d) => {
    const { key, label } = bucketKeyAndLabel(d, granularity);
    return {
      label,
      sales: (salesByBucket.get(key) ?? new Decimal(0)).toFixed(2),
      purchases: (purchasesByBucket.get(key) ?? new Decimal(0)).toFixed(2),
    };
  });

  const chartPaymentsOverTime = buckets.map((d) => {
    const { key, label } = bucketKeyAndLabel(d, granularity);
    return {
      label,
      received: (receivedByBucket.get(key) ?? new Decimal(0)).toFixed(2),
      paid: (paidByBucket.get(key) ?? new Decimal(0)).toFixed(2),
    };
  });

  const chartExpensesByCategory = expensesByCategory
    .map((g) => ({ category: g.category, amount: dec(g._sum.amount) }))
    .filter((g) => Number(g.amount) > 0)
    .sort((a, b) => Number(b.amount) - Number(a.amount));

  return {
    totalSales: totalSales.toFixed(2),
    totalPurchases: totalPurchases.toFixed(2),
    outstandingAmount: salesOutstanding.plus(purchaseOutstanding).toFixed(2),
    paidAmount: paidAmount.toFixed(2),
    overdueCount,
    draftCount,
    recent: recentRows.map(mapSummary),

    receivables: salesOutstanding.toFixed(2),
    payables: purchaseOutstanding.toFixed(2),
    overdueReceivable: salesOverdue.toFixed(2),
    overduePayable: purchaseOverdue.toFixed(2),
    totalExpenses: dec(expensesAgg._sum.amount),

    salesSummary: {
      invoiced: totalSales.toFixed(2),
      received: received.toFixed(2),
      outstanding: salesOutstanding.toFixed(2),
      overdue: salesOverdue.toFixed(2),
      creditNotes: creditNotes.toFixed(2),
      salesReturns: salesReturns.toFixed(2),
    },
    purchaseSummary: {
      purchased: totalPurchases.toFixed(2),
      paid: paid.toFixed(2),
      outstanding: purchaseOutstanding.toFixed(2),
      debitNotes: debitNotes.toFixed(2),
    },

    chartSalesVsPurchase,
    chartPaymentsOverTime,
    chartExpensesByCategory,
  };
}
