"use server";

import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { getUser } from "@/lib/session";
import { calculateInvoiceTotals } from "@/lib/invoicing/calc";
import { previewNextInvoiceNumber, consumeNextInvoiceNumber } from "@/lib/invoicing/numbering";
import { resolveInvoiceAccess } from "@/lib/invoicing/permissions";
import { invoiceFamily, isValidDerivation } from "@/lib/invoicing/family";
import { isManuallySettableStatus } from "@/lib/invoicing/status";
import type { DashboardPeriod } from "@/lib/invoicing/period";
import { logInvoiceActivity } from "@/lib/invoicing/activity";
import {
  getInvoiceById,
  listInvoicesForOwner,
  getDashboardStatsForOwner,
  getRelatedDocuments,
  getInvoiceActivity,
} from "@/lib/invoicing/queries";
import { getOrCreateCatalogForOwner } from "@/lib/catalog-queries";
import { INVOICE_STATUS_LABELS } from "@/lib/invoicing/ui";
import { invoiceFormSchema, type InvoiceFormValues, type InvoiceItemInputValues } from "@/lib/validations/invoicing";
import type {
  InvoiceRecord,
  InvoiceSummary,
  InvoiceListFilter,
  InvoiceDashboardStats,
  InvoiceActionResult,
  InvoiceType,
  InvoiceStatus,
  DirectoryOption,
  CatalogRowOption,
  RelatedDocuments,
  InvoiceActivityRecord,
} from "@/types/invoicing";

async function requireUser() {
  return getUser();
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

function buildCalcInput(d: InvoiceFormValues) {
  return {
    taxMode: d.taxMode,
    taxBreakup: d.taxBreakup,
    items: d.items.map((it) => ({
      quantity: it.quantity,
      rate: it.rate,
      discountPercent: it.discountPercent,
      taxPercent: it.taxPercent,
    })),
    shippingCharge: d.shippingCharge,
    miscCharge: d.miscCharge,
    additionalDiscount: d.additionalDiscount,
  };
}

function buildInvoiceData(d: InvoiceFormValues, calc: ReturnType<typeof calculateInvoiceTotals>) {
  return {
    type: d.type,
    status: d.status,
    invoiceDate: new Date(d.invoiceDate),
    dueDate: new Date(d.dueDate),
    currency: d.currency,
    paymentTerms: d.paymentTerms?.trim() || null,
    referenceNumber: d.referenceNumber?.trim() || null,

    sellerName: d.sellerName.trim(),
    sellerAddress: d.sellerAddress?.trim() || null,
    sellerTaxId: d.sellerTaxId?.trim() || null,
    sellerPhone: d.sellerPhone?.trim() || null,
    sellerEmail: d.sellerEmail?.trim() || null,
    sellerLogoUrl: d.sellerLogoUrl?.trim() || null,

    counterpartyUserId: d.counterpartyUserId || null,
    partyName: d.partyName.trim(),
    partyContactPerson: d.partyContactPerson?.trim() || null,
    partyEmail: d.partyEmail?.trim() || null,
    partyPhone: d.partyPhone?.trim() || null,
    partyBillingAddress: d.partyBillingAddress?.trim() || null,
    partyShippingAddress: d.partyShippingAddress?.trim() || null,
    partyTaxId: d.partyTaxId?.trim() || null,

    taxMode: d.taxMode,
    taxBreakup: d.taxBreakup,

    subtotal: calc.subtotal,
    itemDiscountTotal: calc.itemDiscountTotal,
    taxableAmount: calc.taxableAmount,
    cgstTotal: calc.cgstTotal,
    sgstTotal: calc.sgstTotal,
    igstTotal: calc.igstTotal,
    taxTotal: calc.taxTotal,
    shippingCharge: calc.shippingCharge,
    miscCharge: calc.miscCharge,
    miscChargeLabel: d.miscChargeLabel?.trim() || null,
    additionalDiscount: calc.additionalDiscount,
    roundOff: calc.roundOff,
    grandTotal: calc.grandTotal,

    customerNotes: d.customerNotes?.trim() || null,
    termsAndConditions: d.termsAndConditions?.trim() || null,

    reason: d.reason ?? null,
  };
}

function buildItemsData(items: InvoiceItemInputValues[], calc: ReturnType<typeof calculateInvoiceTotals>) {
  return items.map((it, i) => {
    const c = calc.items[i];
    return {
      catalogRowId: it.catalogRowId || null,
      productName: it.productName.trim(),
      description: it.description?.trim() || null,
      hsnSac: it.hsnSac?.trim() || null,
      quantity: it.quantity,
      unit: it.unit.trim() || "pcs",
      rate: it.rate,
      discountPercent: it.discountPercent || "0",
      discountAmount: c.discountAmount,
      taxPercent: it.taxPercent || "0",
      taxAmount: c.taxAmount,
      lineTotal: c.lineTotal,
      order: i,
    };
  });
}

// ─── Reads ───────────────────────────────────────────────────────────────

export async function getInvoiceAction(id: string): Promise<InvoiceActionResult<InvoiceRecord>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const invoice = await getInvoiceById(id);
  if (!invoice) return { success: false, error: "Invoice not found." };

  const access = resolveInvoiceAccess({ userId: user.id, invoice });
  if (!access.canView) return { success: false, error: "Invoice not found." };

  return { success: true, data: invoice };
}

export async function listInvoicesAction(filter: InvoiceListFilter): Promise<InvoiceActionResult<InvoiceSummary[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  return { success: true, data: await listInvoicesForOwner(user.id, filter) };
}

export async function getInvoiceDashboardStatsAction(period?: DashboardPeriod): Promise<InvoiceActionResult<InvoiceDashboardStats>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  return { success: true, data: await getDashboardStatsForOwner(user.id, period) };
}

export async function previewNextInvoiceNumberAction(
  type: InvoiceType
): Promise<InvoiceActionResult<{ invoiceNumber: string }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  return { success: true, data: { invoiceNumber: await previewNextInvoiceNumber(user.id, type) } };
}

export async function getPartyOptionsAction(type: InvoiceType): Promise<InvoiceActionResult<DirectoryOption[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const role = invoiceFamily(type) === "SALES" ? "BUYER" : "SUPPLIER";
  const rows = await db.user.findMany({
    where: { role },
    select: {
      id: true,
      name: true,
      email: true,
      buyer: { select: { companyName: true } },
      supplier: { select: { companyName: true } },
    },
    orderBy: { name: "asc" },
  });
  return {
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      companyName: r.buyer?.companyName ?? r.supplier?.companyName ?? "",
    })),
  };
}

/** Prefill defaults for the "Seller/Company Information" section from the logged-in org — spec §7. */
export async function getSellerDefaultsAction(): Promise<
  InvoiceActionResult<{
    sellerName: string;
    sellerEmail: string;
    sellerPhone: string | null;
    sellerAddress: string | null;
    sellerTaxId: string | null;
    sellerLogoUrl: string | null;
  }>
> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const [supplier, buyer] = await Promise.all([
    db.supplier.findUnique({ where: { userId: user.id }, select: { companyName: true, logo: true } }),
    db.buyer.findUnique({ where: { userId: user.id }, select: { companyName: true } }),
  ]);

  return {
    success: true,
    data: {
      sellerName: supplier?.companyName ?? buyer?.companyName ?? user.name,
      sellerEmail: user.email,
      sellerPhone: null,
      sellerAddress: null,
      sellerTaxId: null,
      sellerLogoUrl: supplier?.logo ?? null,
    },
  };
}

export async function getCatalogRowOptionsAction(): Promise<InvoiceActionResult<CatalogRowOption[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const catalog = await getOrCreateCatalogForOwner(user.id);
  return {
    success: true,
    data: catalog.rows
      .filter((r) => r.status === "ACTIVE")
      .map((r) => ({
        id: r.id,
        productName: r.productName,
        description: r.description,
        sku: r.sku,
        hsnCode: r.hsnCode,
        imageUrl: r.images[0]?.dataUrl ?? null,
        quantity: r.quantity,
        gstPercent: r.gstPercent,
        priceBeforeGst: r.priceBeforeGst,
        priceAfterGst: r.priceAfterGst,
        currency: r.currency,
      })),
  };
}

// ─── Mutations ───────────────────────────────────────────────────────────

export async function getRelatedDocumentsAction(id: string): Promise<InvoiceActionResult<RelatedDocuments>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const invoice = await getInvoiceById(id);
  if (!invoice) return { success: false, error: "Invoice not found." };
  const access = resolveInvoiceAccess({ userId: user.id, invoice });
  if (!access.canView) return { success: false, error: "Invoice not found." };

  return { success: true, data: await getRelatedDocuments(id) };
}

export async function getInvoiceActivityAction(id: string): Promise<InvoiceActionResult<InvoiceActivityRecord[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const invoice = await getInvoiceById(id);
  if (!invoice) return { success: false, error: "Invoice not found." };
  const access = resolveInvoiceAccess({ userId: user.id, invoice });
  if (!access.canView) return { success: false, error: "Invoice not found." };

  return { success: true, data: await getInvoiceActivity(id) };
}

/**
 * UX-only pre-save availability hint — never the source of truth. Two
 * concurrent requests can both see "available" and both attempt to save;
 * the real guarantee is the `@@unique([ownerId, type, invoiceNumber])` DB
 * constraint + the P2002 catch in createInvoiceAction/updateInvoiceAction.
 */
export async function checkInvoiceNumberAvailableAction(
  type: InvoiceType,
  invoiceNumber: string,
  excludeId?: string
): Promise<InvoiceActionResult<{ available: boolean }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const trimmed = invoiceNumber.trim();
  if (!trimmed) return { success: true, data: { available: true } };

  const existing = await db.invoice.findUnique({
    where: { ownerId_type_invoiceNumber: { ownerId: user.id, type, invoiceNumber: trimmed } },
    select: { id: true },
  });

  return { success: true, data: { available: !existing || existing.id === excludeId } };
}

export async function createInvoiceAction(input: InvoiceFormValues): Promise<InvoiceActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const parsed = invoiceFormSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  // Dependent documents (Credit Note/Sales Return/Debit Note, or a
  // Quotation being converted to a Tax Invoice) must reference a real
  // source the caller owns, in a valid (sourceType -> targetType) pairing
  // — never trust the client's target-type selection alone.
  if (d.sourceInvoiceId) {
    const source = await db.invoice.findUnique({
      where: { id: d.sourceInvoiceId },
      select: { type: true, ownerId: true },
    });
    if (!source || source.ownerId !== user.id) {
      return { success: false, error: "Source document not found." };
    }
    if (!isValidDerivation(source.type, d.type)) {
      return { success: false, error: "This document type cannot be created from that source." };
    }
  }

  if (!isManuallySettableStatus(d.type, d.status)) {
    return { success: false, error: "That status isn't valid for this document type." };
  }

  const calc = calculateInvoiceTotals(buildCalcInput(d));

  let invoiceNumber = d.invoiceNumber.trim();
  const suggested = await previewNextInvoiceNumber(user.id, d.type);
  if (invoiceNumber === suggested) {
    invoiceNumber = await consumeNextInvoiceNumber(user.id, d.type);
  }

  // A Tax Invoice created from a Quotation marks that Quotation CONVERTED —
  // system-set, mirroring how PAID/PARTIALLY_PAID are system-set from real
  // payments (see lib/invoicing/status.ts) rather than left to drift.
  const convertsQuotation = d.sourceInvoiceId && d.type === "SALES";

  // Activity type/description on both the new document and its source
  // differ per dependent-document kind — spec §19 wants these
  // distinguishable (Quotation Converted / Credit Note Created / ...).
  const DEPENDENT_ACTIVITY: Partial<Record<InvoiceType, { type: string; describeNew: (n: string) => string; describeSource: (n: string) => string }>> = {
    SALES: {
      type: "CONVERTED",
      describeNew: (n) => `Created from quotation, ${n}.`,
      describeSource: (n) => `Converted to Tax Invoice ${n}.`,
    },
    CREDIT_NOTE: {
      type: "CREDIT_NOTE_CREATED",
      describeNew: (n) => `Created from invoice ${n}.`,
      describeSource: (n) => `Credit Note ${n} created from this invoice.`,
    },
    SALES_RETURN: {
      type: "SALES_RETURN_CREATED",
      describeNew: (n) => `Created from invoice ${n}.`,
      describeSource: (n) => `Sales Return ${n} created from this invoice.`,
    },
    DEBIT_NOTE: {
      type: "DEBIT_NOTE_CREATED",
      describeNew: (n) => `Created from invoice ${n}.`,
      describeSource: (n) => `Debit Note ${n} created from this invoice.`,
    },
  };

  try {
    const created = await db.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          ...buildInvoiceData(d, calc),
          invoiceNumber,
          ownerId: user.id,
          sourceInvoiceId: d.sourceInvoiceId || null,
          items: { create: buildItemsData(d.items, calc) },
        },
        select: { id: true },
      });

      if (d.sourceInvoiceId) {
        const sourceNumber = await tx.invoice.findUnique({ where: { id: d.sourceInvoiceId }, select: { invoiceNumber: true } });
        const meta = DEPENDENT_ACTIVITY[d.type];
        await logInvoiceActivity(invoice.id, "CREATED", meta ? meta.describeNew(sourceNumber?.invoiceNumber ?? "") : "Invoice created.", user.id, tx);
        if (meta) {
          await logInvoiceActivity(d.sourceInvoiceId, meta.type, meta.describeSource(invoiceNumber), user.id, tx);
        }
      } else {
        await logInvoiceActivity(invoice.id, "CREATED", "Invoice created.", user.id, tx);
      }

      if (convertsQuotation && d.sourceInvoiceId) {
        await tx.invoice.update({ where: { id: d.sourceInvoiceId }, data: { status: "CONVERTED" } });
      }

      return invoice;
    });
    return { success: true, data: { id: created.id } };
  } catch (err) {
    if (isUniqueConstraintError(err)) return { success: false, error: "This invoice number is already in use." };
    throw err;
  }
}

export async function updateInvoiceAction(
  id: string,
  input: InvoiceFormValues
): Promise<InvoiceActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const existing = await db.invoice.findUnique({
    where: { id },
    select: { ownerId: true, counterpartyUserId: true, type: true },
  });
  if (!existing) return { success: false, error: "Invoice not found." };
  const access = resolveInvoiceAccess({ userId: user.id, invoice: existing });
  if (!access.canEdit) return { success: false, error: "Invoice not found." };

  const parsed = invoiceFormSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (!isManuallySettableStatus(existing.type, d.status)) {
    return { success: false, error: "That status isn't valid for this document type." };
  }

  const calc = calculateInvoiceTotals(buildCalcInput(d));

  try {
    await db.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id },
        data: {
          ...buildInvoiceData(d, calc),
          invoiceNumber: d.invoiceNumber.trim(),
          items: { deleteMany: {}, create: buildItemsData(d.items, calc) },
        },
      });
      await logInvoiceActivity(id, "UPDATED", "Invoice details updated.", user.id, tx);
    });
    return { success: true, data: { id } };
  } catch (err) {
    if (isUniqueConstraintError(err)) return { success: false, error: "This invoice number is already in use." };
    throw err;
  }
}

export async function duplicateInvoiceAction(id: string): Promise<InvoiceActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const existing = await db.invoice.findUnique({ where: { id }, include: { items: { orderBy: { order: "asc" } } } });
  if (!existing) return { success: false, error: "Invoice not found." };
  const access = resolveInvoiceAccess({ userId: user.id, invoice: existing });
  if (!access.canDuplicate) return { success: false, error: "Invoice not found." };

  const invoiceNumber = await consumeNextInvoiceNumber(user.id, existing.type);

  const copy = await db.invoice.create({
    data: {
      type: existing.type,
      ownerId: user.id,
      counterpartyUserId: existing.counterpartyUserId,
      invoiceNumber,
      status: "DRAFT",

      invoiceDate: new Date(),
      dueDate: existing.dueDate,
      currency: existing.currency,
      paymentTerms: existing.paymentTerms,
      referenceNumber: existing.referenceNumber,

      sellerName: existing.sellerName,
      sellerAddress: existing.sellerAddress,
      sellerTaxId: existing.sellerTaxId,
      sellerPhone: existing.sellerPhone,
      sellerEmail: existing.sellerEmail,
      sellerLogoUrl: existing.sellerLogoUrl,

      partyName: existing.partyName,
      partyContactPerson: existing.partyContactPerson,
      partyEmail: existing.partyEmail,
      partyPhone: existing.partyPhone,
      partyBillingAddress: existing.partyBillingAddress,
      partyShippingAddress: existing.partyShippingAddress,
      partyTaxId: existing.partyTaxId,

      taxMode: existing.taxMode,
      taxBreakup: existing.taxBreakup,

      subtotal: existing.subtotal,
      itemDiscountTotal: existing.itemDiscountTotal,
      taxableAmount: existing.taxableAmount,
      cgstTotal: existing.cgstTotal,
      sgstTotal: existing.sgstTotal,
      igstTotal: existing.igstTotal,
      taxTotal: existing.taxTotal,
      shippingCharge: existing.shippingCharge,
      miscCharge: existing.miscCharge,
      miscChargeLabel: existing.miscChargeLabel,
      additionalDiscount: existing.additionalDiscount,
      roundOff: existing.roundOff,
      grandTotal: existing.grandTotal,

      customerNotes: existing.customerNotes,
      termsAndConditions: existing.termsAndConditions,

      items: {
        create: existing.items.map((it) => ({
          catalogRowId: it.catalogRowId,
          productName: it.productName,
          description: it.description,
          hsnSac: it.hsnSac,
          quantity: it.quantity,
          unit: it.unit,
          rate: it.rate,
          discountPercent: it.discountPercent,
          discountAmount: it.discountAmount,
          taxPercent: it.taxPercent,
          taxAmount: it.taxAmount,
          lineTotal: it.lineTotal,
          order: it.order,
        })),
      },
    },
    select: { id: true },
  });
  await logInvoiceActivity(copy.id, "CREATED", `Duplicated from ${existing.invoiceNumber}.`, user.id);
  return { success: true, data: { id: copy.id } };
}

export async function setInvoiceStatusAction(id: string, status: InvoiceStatus): Promise<InvoiceActionResult<void>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const existing = await db.invoice.findUnique({ where: { id }, select: { ownerId: true, counterpartyUserId: true, type: true, status: true } });
  if (!existing) return { success: false, error: "Invoice not found." };
  const access = resolveInvoiceAccess({ userId: user.id, invoice: existing });
  if (!access.canChangeStatus) return { success: false, error: "Invoice not found." };

  if (!isManuallySettableStatus(existing.type, status)) {
    return { success: false, error: "That status isn't valid for this document type." };
  }

  await db.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id }, data: { status } });
    await logInvoiceActivity(
      id,
      "STATUS_CHANGED",
      `Status changed from ${INVOICE_STATUS_LABELS[existing.status]} to ${INVOICE_STATUS_LABELS[status]}.`,
      user.id,
      tx
    );
  });

  return { success: true, data: undefined };
}

export async function archiveInvoiceAction(id: string): Promise<InvoiceActionResult<void>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const existing = await db.invoice.findUnique({ where: { id }, select: { ownerId: true, counterpartyUserId: true } });
  if (!existing) return { success: false, error: "Invoice not found." };
  const access = resolveInvoiceAccess({ userId: user.id, invoice: existing });
  if (!access.canArchive) return { success: false, error: "Invoice not found." };

  await db.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id }, data: { archivedAt: new Date() } });
    await logInvoiceActivity(id, "ARCHIVED", "Invoice archived.", user.id, tx);
  });
  return { success: true, data: undefined };
}
