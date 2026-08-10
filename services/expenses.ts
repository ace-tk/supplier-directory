"use server";

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { expenseFormSchema, type ExpenseFormValues } from "@/lib/validations/expense";
import { getExpenseById, listExpensesForOwner } from "@/lib/expenses/queries";
import type {
  ExpenseRecord,
  ExpenseListFilter,
  ExpenseActionResult,
  InvoiceOption,
} from "@/types/expense";
import type { DirectoryOption } from "@/types/invoicing";

async function requireUser() {
  return getUser();
}

async function requireOwnedExpense(id: string, ownerId: string) {
  const expense = await db.expense.findUnique({ where: { id }, select: { ownerId: true } });
  if (!expense || expense.ownerId !== ownerId) return null;
  return expense;
}

function buildExpenseData(d: ExpenseFormValues) {
  return {
    occurredAt: new Date(d.occurredAt),
    location: d.location?.trim() || null,
    category: d.category,
    customCategoryLabel: d.category === "OTHER" ? d.customCategoryLabel?.trim() || null : null,
    amount: d.amount,
    currency: d.currency,
    notes: d.notes?.trim() || null,
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
    data: { ...buildExpenseData(parsed.data), ownerId: user.id },
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

  await db.expense.update({ where: { id }, data: buildExpenseData(parsed.data) });
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
