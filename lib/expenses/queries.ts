// Real, DB-backed read layer for Expenses — scoped per owner across all
// four portals. Decimal fields are converted to plain strings here, before
// crossing into any client component.

import { db } from "@/lib/db";
import type { ExpenseRecord, ExpenseListFilter } from "@/types/expense";

function dec(value: { toString(): string } | null | undefined): string {
  return value == null ? "0" : value.toString();
}

const expenseInclude = {
  partyUser: { select: { name: true, buyer: { select: { companyName: true } }, supplier: { select: { companyName: true } } } },
  relatedInvoice: { select: { invoiceNumber: true } },
};

type ExpenseRow = Awaited<ReturnType<typeof db.expense.findMany<{ where: { ownerId: string }; include: typeof expenseInclude }>>>[number];

function mapExpense(e: ExpenseRow): ExpenseRecord {
  return {
    id: e.id,
    ownerId: e.ownerId,

    occurredAt: e.occurredAt.toISOString(),
    location: e.location,
    category: e.category,
    customCategoryLabel: e.customCategoryLabel,
    amount: dec(e.amount),
    currency: e.currency,
    notes: e.notes,

    partyUserId: e.partyUserId,
    partyName: e.partyUser
      ? (e.partyUser.buyer?.companyName ?? e.partyUser.supplier?.companyName ?? e.partyUser.name)
      : null,

    relatedInvoiceId: e.relatedInvoiceId,
    relatedInvoiceNumber: e.relatedInvoice?.invoiceNumber ?? null,

    attachmentFileName: e.attachmentFileName,
    attachmentUrl: e.attachmentUrl,

    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

export async function getExpenseById(id: string): Promise<ExpenseRecord | null> {
  const row = await db.expense.findUnique({ where: { id }, include: expenseInclude });
  return row ? mapExpense(row) : null;
}

export async function listExpensesForOwner(ownerId: string, filter: ExpenseListFilter): Promise<ExpenseRecord[]> {
  const rows = await db.expense.findMany({
    where: {
      ownerId,
      ...(filter.category ? { category: filter.category } : {}),
      ...(filter.partyUserId ? { partyUserId: filter.partyUserId } : {}),
      ...(filter.dateFrom || filter.dateTo
        ? {
            occurredAt: {
              ...(filter.dateFrom ? { gte: new Date(filter.dateFrom) } : {}),
              ...(filter.dateTo ? { lte: new Date(filter.dateTo) } : {}),
            },
          }
        : {}),
      ...(filter.search
        ? {
            OR: [
              { location: { contains: filter.search, mode: "insensitive" as const } },
              { notes: { contains: filter.search, mode: "insensitive" as const } },
              { relatedInvoice: { invoiceNumber: { contains: filter.search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    include: expenseInclude,
    orderBy: { occurredAt: "desc" },
  });
  return rows.map(mapExpense);
}
