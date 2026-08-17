"use server";

import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { getUser } from "@/lib/session";
import { expenseFormSchema, type ExpenseFormValues } from "@/lib/validations/expense";
import { getExpenseById, listExpensesForOwner } from "@/lib/expenses/queries";
import { validateExpenseImportRows } from "@/lib/expenses/import";
import { EXPENSE_IMPORT_MAX_ROWS } from "@/lib/expenses/import-types";
import { SALES_FAMILY_TYPES, PURCHASE_FAMILY_TYPES, invoiceFamily } from "@/lib/invoicing/family";
import type {
  ExpenseRecord,
  ExpenseListFilter,
  ExpenseActionResult,
  InvoiceOption,
  PartyInvoiceOption,
  ExpenseCustomCategoryOption,
  ExpenseContactOption,
  PaymentAccountOption,
  PaymentMethod,
} from "@/types/expense";
import type { DirectoryOption } from "@/types/invoicing";
import type { ExpenseImportRawRow, ExpenseImportRowResult, ExpenseImportSummary } from "@/lib/expenses/import-types";

async function requireUser() {
  return getUser();
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

async function requireOwnedExpense(id: string, ownerId: string) {
  const expense = await db.expense.findUnique({ where: { id }, select: { ownerId: true } });
  if (!expense || expense.ownerId !== ownerId) return null;
  return expense;
}

/**
 * When a saved custom category is selected, its name (authoritative from
 * the DB, not whatever the client sent) is copied into customCategoryLabel
 * too, so existing display code that only reads customCategoryLabel needs
 * no changes.
 */
async function resolveCustomCategoryName(ownerId: string, customCategoryId: string | null | undefined): Promise<string | null> {
  if (!customCategoryId) return null;
  const row = await db.expenseCustomCategory.findUnique({ where: { id: customCategoryId }, select: { name: true, ownerId: true } });
  return row && row.ownerId === ownerId ? row.name : null;
}

async function buildExpenseData(ownerId: string, d: ExpenseFormValues) {
  const customCategoryName = d.category === "OTHER" ? await resolveCustomCategoryName(ownerId, d.customCategoryId) : null;
  return {
    occurredAt: new Date(d.occurredAt),
    location: d.location?.trim() || null,
    locationLat: d.locationLat ?? null,
    locationLng: d.locationLng ?? null,
    category: d.category,
    customCategoryId: d.category === "OTHER" && customCategoryName ? d.customCategoryId : null,
    customCategoryLabel: d.category === "OTHER" ? (customCategoryName ?? d.customCategoryLabel?.trim() ?? null) : null,
    amount: d.amount,
    currency: d.currency,
    notes: d.notes?.trim() || null,
    gstNumber: d.gstNumber?.trim() || null,
    gstPercent: d.gstPercent ?? null,
    paymentMethod: (d.paymentMethod as PaymentMethod | null | undefined) ?? null,
    department: d.department?.trim() || null,
    expenseType: d.expenseType?.trim() || null,
    partyUserId: d.partyUserId || null,
    relatedInvoiceId: d.relatedInvoiceId || null,
    buyerUserId: d.buyerUserId || null,
    supplierUserId: d.supplierUserId || null,
    relatedPurchaseInvoiceId: d.relatedPurchaseInvoiceId || null,
    manualPartyName: d.manualPartyName?.trim() || null,
    contactId: d.contactId || null,
    manualContactName: d.manualContactName?.trim() || null,
    manualContactPhone: d.manualContactPhone?.trim() || null,
    manualContactCountryCode: d.manualContactCountryCode?.trim() || null,
    paymentAccountId: d.paymentAccountId || null,
    referenceNumber: d.referenceNumber?.trim() || null,
    createVoucher: d.createVoucher ?? false,
    voucherTemplate: d.createVoucher ? (d.voucherTemplate ?? "REGULAR") : null,
    attachmentFileName: d.attachmentFileName?.trim() || null,
    attachmentUrl: d.attachmentUrl?.trim() || null,
  };
}

/**
 * Never trusts client-supplied relation IDs: re-checks each cross-party
 * link against the live DB before it's allowed to be saved. Throws a
 * user-facing Error on the first violation found; callers convert that into
 * an ExpenseActionResult failure.
 */
async function validateLinks(ownerId: string, d: ExpenseFormValues): Promise<void> {
  if (d.buyerUserId && d.relatedInvoiceId) {
    const inv = await db.invoice.findUnique({
      where: { id: d.relatedInvoiceId },
      select: { ownerId: true, counterpartyUserId: true, type: true },
    });
    if (!inv || inv.ownerId !== ownerId || inv.counterpartyUserId !== d.buyerUserId || invoiceFamily(inv.type) !== "SALES") {
      throw new Error("Selected invoice does not belong to the selected buyer.");
    }
  }
  if (d.supplierUserId && d.relatedPurchaseInvoiceId) {
    const inv = await db.invoice.findUnique({
      where: { id: d.relatedPurchaseInvoiceId },
      select: { ownerId: true, counterpartyUserId: true, type: true },
    });
    if (!inv || inv.ownerId !== ownerId || inv.counterpartyUserId !== d.supplierUserId || invoiceFamily(inv.type) !== "PURCHASE") {
      throw new Error("Selected purchase does not belong to the selected supplier.");
    }
  }
  if (d.contactId) {
    const contact = await db.expenseContact.findUnique({ where: { id: d.contactId }, select: { ownerId: true } });
    if (!contact || contact.ownerId !== ownerId) throw new Error("Invalid contact selected.");
  }
  if (d.paymentAccountId) {
    const account = await db.paymentAccount.findUnique({ where: { id: d.paymentAccountId }, select: { ownerId: true } });
    if (!account || account.ownerId !== ownerId) throw new Error("Invalid payment account selected.");
  }
}

// ─── Reads ───────────────────────────────────────────────────────────────

export async function getExpenseAction(id: string): Promise<ExpenseActionResult<ExpenseRecord>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const expense = await getExpenseById(id);
  if (!expense || expense.ownerId !== user.id) return { success: false, error: "Expense not found." };
  return { success: true, data: expense };
}

export async function listExpensesAction(filter: ExpenseListFilter): Promise<ExpenseActionResult<ExpenseRecord[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  return { success: true, data: await listExpensesForOwner(user.id, filter) };
}

/** Buyers + Suppliers merged into one picker — an expense's party can be either side. */
export async function getExpensePartyOptionsAction(): Promise<ExpenseActionResult<DirectoryOption[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const rows = await db.user.findMany({
    where: { role: { in: ["BUYER", "SUPPLIER"] } },
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

function directoryWhere(role: "BUYER" | "SUPPLIER", search: string) {
  const trimmed = search.trim();
  return {
    role,
    ...(trimmed
      ? {
          OR: [
            { name: { contains: trimmed, mode: "insensitive" as const } },
            { email: { contains: trimmed, mode: "insensitive" as const } },
            { buyer: { companyName: { contains: trimmed, mode: "insensitive" as const } } },
            { supplier: { companyName: { contains: trimmed, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
}

/** Real Buyers only (role=BUYER) — used by the Basic Details "Company /
 * Person" picker, distinct from the merged getExpensePartyOptionsAction. */
export async function searchBuyersAction(search: string): Promise<ExpenseActionResult<DirectoryOption[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const rows = await db.user.findMany({
    where: directoryWhere("BUYER", search),
    select: { id: true, name: true, email: true, buyer: { select: { companyName: true } } },
    orderBy: { name: "asc" },
    take: 20,
  });
  return { success: true, data: rows.map((r) => ({ id: r.id, name: r.name, email: r.email, companyName: r.buyer?.companyName ?? "" })) };
}

/** Real Suppliers only (role=SUPPLIER) — used by the Basic Details "Company
 * / Supplier" picker. */
export async function searchSuppliersAction(search: string): Promise<ExpenseActionResult<DirectoryOption[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const rows = await db.user.findMany({
    where: directoryWhere("SUPPLIER", search),
    select: { id: true, name: true, email: true, supplier: { select: { companyName: true } } },
    orderBy: { name: "asc" },
    take: 20,
  });
  return { success: true, data: rows.map((r) => ({ id: r.id, name: r.name, email: r.email, companyName: r.supplier?.companyName ?? "" })) };
}

/** Sales-family invoices belonging to a specific Buyer, scoped to the
 * current owner — never shows another party's invoices. */
export async function getBuyerInvoicesAction(
  buyerUserId: string,
  search = "",
  limit = 5
): Promise<ExpenseActionResult<PartyInvoiceOption[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  if (!buyerUserId) return { success: true, data: [] };

  const rows = await db.invoice.findMany({
    where: {
      ownerId: user.id,
      counterpartyUserId: buyerUserId,
      type: { in: SALES_FAMILY_TYPES },
      archivedAt: null,
      ...(search.trim() ? { invoiceNumber: { contains: search.trim(), mode: "insensitive" as const } } : {}),
    },
    select: { id: true, invoiceNumber: true, invoiceDate: true, grandTotal: true, currency: true, partyTaxId: true },
    orderBy: { invoiceDate: "desc" },
    take: limit,
  });
  return {
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      invoiceDate: r.invoiceDate.toISOString(),
      grandTotal: r.grandTotal.toString(),
      currency: r.currency,
      partyTaxId: r.partyTaxId,
    })),
  };
}

/** Purchase-family invoices belonging to a specific Supplier, scoped to the
 * current owner. */
export async function getSupplierPurchasesAction(
  supplierUserId: string,
  search = "",
  limit = 5
): Promise<ExpenseActionResult<PartyInvoiceOption[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  if (!supplierUserId) return { success: true, data: [] };

  const rows = await db.invoice.findMany({
    where: {
      ownerId: user.id,
      counterpartyUserId: supplierUserId,
      type: { in: PURCHASE_FAMILY_TYPES },
      archivedAt: null,
      ...(search.trim() ? { invoiceNumber: { contains: search.trim(), mode: "insensitive" as const } } : {}),
    },
    select: { id: true, invoiceNumber: true, invoiceDate: true, grandTotal: true, currency: true, partyTaxId: true },
    orderBy: { invoiceDate: "desc" },
    take: limit,
  });
  return {
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      invoiceDate: r.invoiceDate.toISOString(),
      grandTotal: r.grandTotal.toString(),
      currency: r.currency,
      partyTaxId: r.partyTaxId,
    })),
  };
}

/** Saved contacts for the current owner, optionally scoped to one Buyer/
 * Supplier User. */
export async function listExpenseContactsAction(partyUserId?: string | null): Promise<ExpenseActionResult<ExpenseContactOption[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const rows = await db.expenseContact.findMany({
    where: { ownerId: user.id, ...(partyUserId ? { partyUserId } : {}) },
    select: { id: true, partyUserId: true, name: true, email: true, phone: true, countryCode: true },
    orderBy: { name: "asc" },
  });
  return { success: true, data: rows };
}

/** Only ever called when the user explicitly checks "Save to contacts" —
 * never invoked automatically by createExpenseAction/updateExpenseAction. */
export async function createExpenseContactAction(input: {
  partyUserId?: string | null;
  name: string;
  email?: string;
  phone?: string;
  countryCode?: string;
}): Promise<ExpenseActionResult<ExpenseContactOption>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const name = input.name.trim();
  if (!name) return { success: false, error: "Contact name is required." };

  const created = await db.expenseContact.create({
    data: {
      ownerId: user.id,
      partyUserId: input.partyUserId || null,
      name,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      countryCode: input.countryCode?.trim() || "+91",
    },
    select: { id: true, partyUserId: true, name: true, email: true, phone: true, countryCode: true },
  });
  return { success: true, data: created };
}

export async function listPaymentAccountsAction(type?: PaymentMethod | null): Promise<ExpenseActionResult<PaymentAccountOption[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const rows = await db.paymentAccount.findMany({
    where: { ownerId: user.id, ...(type ? { type } : {}) },
    select: { id: true, label: true, type: true, provider: true, last4: true },
    orderBy: [{ isDefault: "desc" }, { label: "asc" }],
  });
  return { success: true, data: rows };
}

export async function createPaymentAccountAction(input: {
  label: string;
  type: PaymentMethod;
  provider?: string;
  last4?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
}): Promise<ExpenseActionResult<PaymentAccountOption>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const label = input.label.trim();
  if (!label) return { success: false, error: "Account label is required." };

  const created = await db.paymentAccount.create({
    data: {
      ownerId: user.id,
      label,
      type: input.type,
      provider: input.provider?.trim() || null,
      last4: input.last4?.trim() || null,
      accountNumber: input.accountNumber?.trim() || null,
      ifscCode: input.ifscCode?.trim() || null,
      upiId: input.upiId?.trim() || null,
    },
    select: { id: true, label: true, type: true, provider: true, last4: true },
  });
  return { success: true, data: created };
}

export async function listExpenseCustomCategoriesAction(): Promise<ExpenseActionResult<ExpenseCustomCategoryOption[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const rows = await db.expenseCustomCategory.findMany({
    where: { ownerId: user.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return { success: true, data: rows };
}

/** Creates a new custom expense category, or returns the existing one if
 * the owner already has a category with this name (case-sensitive on the
 * unique constraint, so an exact-match lookup first avoids a noisy P2002
 * round-trip for the common "already exists" case). */
export async function createExpenseCustomCategoryAction(name: string): Promise<ExpenseActionResult<ExpenseCustomCategoryOption>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "Category name is required." };
  if (trimmed.length > 50) return { success: false, error: "Category name is too long." };

  const existing = await db.expenseCustomCategory.findUnique({
    where: { ownerId_name: { ownerId: user.id, name: trimmed } },
    select: { id: true, name: true },
  });
  if (existing) return { success: true, data: existing };

  try {
    const created = await db.expenseCustomCategory.create({
      data: { ownerId: user.id, name: trimmed },
      select: { id: true, name: true },
    });
    return { success: true, data: created };
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      const row = await db.expenseCustomCategory.findUnique({
        where: { ownerId_name: { ownerId: user.id, name: trimmed } },
        select: { id: true, name: true },
      });
      if (row) return { success: true, data: row };
    }
    throw err;
  }
}

export async function getExpenseInvoiceOptionsAction(search: string): Promise<ExpenseActionResult<InvoiceOption[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  if (!search.trim()) return { success: true, data: [] };

  const rows = await db.invoice.findMany({
    where: { ownerId: user.id, archivedAt: null, invoiceNumber: { contains: search, mode: "insensitive" } },
    select: { id: true, invoiceNumber: true, partyName: true },
    orderBy: { invoiceDate: "desc" },
    take: 20,
  });
  return { success: true, data: rows };
}

// ─── Mutations ───────────────────────────────────────────────────────────

export async function createExpenseAction(input: ExpenseFormValues): Promise<ExpenseActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const parsed = expenseFormSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    await validateLinks(user.id, parsed.data);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Invalid linked record." };
  }

  const created = await db.expense.create({
    data: { ...(await buildExpenseData(user.id, parsed.data)), ownerId: user.id },
    select: { id: true },
  });
  return { success: true, data: { id: created.id } };
}

export async function updateExpenseAction(
  id: string,
  input: ExpenseFormValues
): Promise<ExpenseActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const existing = await requireOwnedExpense(id, user.id);
  if (!existing) return { success: false, error: "Expense not found." };

  const parsed = expenseFormSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    await validateLinks(user.id, parsed.data);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Invalid linked record." };
  }

  await db.expense.update({ where: { id }, data: await buildExpenseData(user.id, parsed.data) });
  return { success: true, data: { id } };
}

export async function deleteExpenseAction(id: string): Promise<ExpenseActionResult<void>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const existing = await requireOwnedExpense(id, user.id);
  if (!existing) return { success: false, error: "Expense not found." };

  await db.expense.delete({ where: { id } });
  return { success: true, data: undefined };
}

// ─── Excel import ────────────────────────────────────────────────────────
//
// Parsing happens client-side (lib/expenses/expenses-io.ts); everything
// that matters — resolving parties/invoices against real records the user
// can access, validating categories/amounts/currency/dates — happens here,
// server-side, using the exact same validateExpenseImportRows() for both
// the preview step and the confirm step. Confirm never trusts whatever the
// client saw during preview; it re-resolves against live data.

export async function validateExpenseImportAction(
  rawRows: ExpenseImportRawRow[]
): Promise<ExpenseActionResult<ExpenseImportRowResult[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  if (rawRows.length === 0) return { success: false, error: "No rows found in that file." };
  if (rawRows.length > EXPENSE_IMPORT_MAX_ROWS) {
    return { success: false, error: `Import is limited to ${EXPENSE_IMPORT_MAX_ROWS} rows at a time.` };
  }

  return { success: true, data: await validateExpenseImportRows(user.id, rawRows) };
}

export async function confirmExpenseImportAction(
  rawRows: ExpenseImportRawRow[]
): Promise<ExpenseActionResult<ExpenseImportSummary>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  if (rawRows.length === 0) return { success: false, error: "No rows to import." };
  if (rawRows.length > EXPENSE_IMPORT_MAX_ROWS) {
    return { success: false, error: `Import is limited to ${EXPENSE_IMPORT_MAX_ROWS} rows at a time.` };
  }

  const rows = await validateExpenseImportRows(user.id, rawRows);
  const validRows = rows.filter((r) => r.status === "valid");

  if (validRows.length > 0) {
    const customCategoryIds = [...new Set(validRows.map((r) => r.resolved.customCategoryId).filter((id): id is string => Boolean(id)))];
    const customCategories =
      customCategoryIds.length > 0
        ? await db.expenseCustomCategory.findMany({ where: { id: { in: customCategoryIds } }, select: { id: true, name: true } })
        : [];
    const customCategoryNames = new Map(customCategories.map((c) => [c.id, c.name]));

    // A single createMany is one INSERT statement — either every valid row
    // lands or (on an unexpected DB error) none do, so there is no
    // ambiguous partially-imported state to clean up.
    await db.expense.createMany({
      data: validRows.map((r) => ({
        ownerId: user.id,
        occurredAt: new Date(r.resolved.occurredAt!),
        location: r.resolved.location || null,
        category: r.resolved.category!,
        customCategoryId: r.resolved.customCategoryId,
        customCategoryLabel: r.resolved.customCategoryId ? (customCategoryNames.get(r.resolved.customCategoryId) ?? null) : null,
        amount: r.resolved.amount!,
        currency: r.resolved.currency!,
        notes: r.resolved.notes || null,
        partyUserId: r.resolved.partyUserId,
        relatedInvoiceId: r.resolved.relatedInvoiceId,
      })),
    });
  }

  return {
    success: true,
    data: { importedCount: validRows.length, rejectedCount: rows.length - validRows.length, rows },
  };
}
