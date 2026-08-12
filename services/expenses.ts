"use server";

import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { getUser } from "@/lib/session";
import { expenseFormSchema, type ExpenseFormValues } from "@/lib/validations/expense";
import { getExpenseById, listExpensesForOwner } from "@/lib/expenses/queries";
import { validateExpenseImportRows } from "@/lib/expenses/import";
import { EXPENSE_IMPORT_MAX_ROWS } from "@/lib/expenses/import-types";
import type {
  ExpenseRecord,
  ExpenseListFilter,
  ExpenseActionResult,
  InvoiceOption,
  ExpenseCustomCategoryOption,
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
    attachmentFileName: d.attachmentFileName?.trim() || null,
    attachmentUrl: d.attachmentUrl?.trim() || null,
  };
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
