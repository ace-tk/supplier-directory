// Real, DB-backed read layer for Invoice Management — scoped per owner
// across all four portals. Decimal fields are always converted to plain
// strings here, before crossing into any client component.

import { db } from "@/lib/db";
import type {
  InvoiceRecord,
  InvoiceItemRecord,
  InvoiceSummary,
  InvoiceListFilter,
  InvoiceDashboardStats,
  RelatedDocuments,
} from "@/types/invoicing";

function dec(value: { toString(): string } | null | undefined): string {
  return value == null ? "0" : value.toString();
}

const itemsInclude = { items: { orderBy: { order: "asc" as const } } };

type InvoiceRow = NonNullable<Awaited<ReturnType<typeof fetchInvoiceRaw>>>;
type InvoiceItemRow = InvoiceRow["items"][number];
type InvoiceSummaryRow = Awaited<ReturnType<typeof db.invoice.findMany>>[number];

function fetchInvoiceRaw(id: string) {
  return db.invoice.findUnique({ where: { id }, include: itemsInclude });
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
    shippingCharge: dec(inv.shippingCharge),
    miscCharge: dec(inv.miscCharge),
    miscChargeLabel: inv.miscChargeLabel,
    additionalDiscount: dec(inv.additionalDiscount),
    roundOff: dec(inv.roundOff),
    grandTotal: dec(inv.grandTotal),

    customerNotes: inv.customerNotes,
    termsAndConditions: inv.termsAndConditions,

    reason: inv.reason,
    sourceInvoiceId: inv.sourceInvoiceId,

    archivedAt: inv.archivedAt ? inv.archivedAt.toISOString() : null,

    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
  };
}

function mapInvoice(inv: InvoiceRow): InvoiceRecord {
  return { ...mapSummary(inv), items: inv.items.map(mapItem) };
}

export async function getInvoiceById(id: string): Promise<InvoiceRecord | null> {
  const row = await fetchInvoiceRaw(id);
  return row ? mapInvoice(row) : null;
}

export async function listInvoicesForOwner(
  ownerId: string,
  filter: InvoiceListFilter
): Promise<InvoiceSummary[]> {
  const rows = await db.invoice.findMany({
    where: {
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
      ...(filter.partyName ? { partyName: { contains: filter.partyName, mode: "insensitive" } } : {}),
      ...(filter.search
        ? {
            OR: [
              { invoiceNumber: { contains: filter.search, mode: "insensitive" } },
              { partyName: { contains: filter.search, mode: "insensitive" } },
              { sellerName: { contains: filter.search, mode: "insensitive" } },
              { items: { some: { productName: { contains: filter.search, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    orderBy: { invoiceDate: "desc" },
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
    invoice.sourceInvoiceId ? db.invoice.findUnique({ where: { id: invoice.sourceInvoiceId } }) : null,
    db.invoice.findMany({ where: { sourceInvoiceId: invoiceId }, orderBy: { createdAt: "desc" } }),
  ]);

  return {
    source: sourceRow ? mapSummary(sourceRow) : null,
    derived: derivedRows.map(mapSummary),
  };
}

export async function getDashboardStatsForOwner(ownerId: string): Promise<InvoiceDashboardStats> {
  const unpaidStatuses = ["SENT", "PENDING", "PARTIALLY_PAID", "OVERDUE"] as const;

  const [salesAgg, purchaseAgg, outstandingAgg, paidAgg, overdueCount, draftCount, recentRows] =
    await Promise.all([
      db.invoice.aggregate({
        where: { ownerId, type: "SALES", archivedAt: null },
        _sum: { grandTotal: true },
      }),
      db.invoice.aggregate({
        where: { ownerId, type: "PURCHASE", archivedAt: null },
        _sum: { grandTotal: true },
      }),
      db.invoice.aggregate({
        where: { ownerId, archivedAt: null, status: { in: [...unpaidStatuses] } },
        _sum: { grandTotal: true },
      }),
      db.invoice.aggregate({
        where: { ownerId, archivedAt: null, status: "PAID" },
        _sum: { grandTotal: true },
      }),
      db.invoice.count({ where: { ownerId, archivedAt: null, status: "OVERDUE" } }),
      db.invoice.count({ where: { ownerId, archivedAt: null, status: "DRAFT" } }),
      db.invoice.findMany({ where: { ownerId, archivedAt: null }, orderBy: { createdAt: "desc" }, take: 8 }),
    ]);

  return {
    totalSales: dec(salesAgg._sum.grandTotal),
    totalPurchases: dec(purchaseAgg._sum.grandTotal),
    outstandingAmount: dec(outstandingAgg._sum.grandTotal),
    paidAmount: dec(paidAgg._sum.grandTotal),
    overdueCount,
    draftCount,
    recent: recentRows.map(mapSummary),
  };
}
