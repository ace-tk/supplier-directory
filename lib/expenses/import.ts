// Server-only validation + resolution for the Expense Excel import — the
// single function used by BOTH the preview step and the confirm step, so
// confirm always re-validates against live data rather than trusting
// whatever the client saw during preview.

import { db } from "@/lib/db";
import { EXPENSE_CATEGORY_OPTIONS, EXPENSE_CATEGORY_LABELS } from "@/lib/expenses/ui";
import type { ExpenseImportRawRow, ExpenseImportRowResult } from "@/lib/expenses/import-types";
import type { ExpenseCategory } from "@/types/expense";

// Same accepted set already used for Catalog and Invoice currency pickers —
// Expense.currency has no DB enum, so this is the closest existing source
// of truth rather than inventing a new list just for import.
const SUPPORTED_CURRENCIES = ["INR", "USD", "EUR", "GBP"];

/**
 * Resolves against system categories first, then the owner's existing
 * custom categories — an unmatched name is always flagged for review, never
 * silently turned into a new custom category during import.
 */
function resolveCategory(
  text: string,
  customCategories: { id: string; name: string }[]
): { category: ExpenseCategory; customCategoryId: string | null } | "INVALID" {
  if (!text.trim()) return { category: "MISCELLANEOUS", customCategoryId: null };
  const needle = text.trim().toLowerCase();
  const byKey = EXPENSE_CATEGORY_OPTIONS.find((c) => c.toLowerCase() === needle || c.toLowerCase() === needle.replace(/\s+/g, "_"));
  if (byKey) return { category: byKey, customCategoryId: null };
  const byLabel = EXPENSE_CATEGORY_OPTIONS.find((c) => EXPENSE_CATEGORY_LABELS[c].toLowerCase() === needle);
  if (byLabel) return { category: byLabel, customCategoryId: null };
  const customMatch = customCategories.find((c) => c.name.toLowerCase() === needle);
  if (customMatch) return { category: "OTHER", customCategoryId: customMatch.id };
  return "INVALID";
}

function resolveDate(dateText: string, timeText: string): string | null {
  if (!dateText.trim()) return null;
  const time = timeText.trim() || "00:00";
  let candidate = new Date(`${dateText.trim()}T${time}`);
  if (Number.isNaN(candidate.getTime())) candidate = new Date(dateText.trim());
  return Number.isNaN(candidate.getTime()) ? null : candidate.toISOString();
}

export async function validateExpenseImportRows(ownerId: string, rawRows: ExpenseImportRawRow[]): Promise<ExpenseImportRowResult[]> {
  const parties = await db.user.findMany({
    where: { role: { in: ["BUYER", "SUPPLIER"] } },
    select: { id: true, name: true, buyer: { select: { companyName: true } }, supplier: { select: { companyName: true } } },
  });
  const partyCandidates = parties.map((p) => {
    const label = p.buyer?.companyName || p.supplier?.companyName || p.name;
    return {
      id: p.id,
      label,
      companyName: (p.buyer?.companyName || p.supplier?.companyName || "").toLowerCase(),
      name: p.name.toLowerCase(),
    };
  });

  const distinctInvoiceTexts = [...new Set(rawRows.map((r) => r.invoice.trim()).filter(Boolean))];
  const invoiceLookups = await Promise.all(
    distinctInvoiceTexts.map(async (text) => {
      const matches = await db.invoice.findMany({
        where: { invoiceNumber: { equals: text, mode: "insensitive" } },
        select: { id: true, invoiceNumber: true, ownerId: true },
      });
      return [text, matches] as const;
    })
  );
  const invoiceIndex = new Map(invoiceLookups);

  const customCategories = await db.expenseCustomCategory.findMany({
    where: { ownerId },
    select: { id: true, name: true },
  });

  return rawRows.map((row): ExpenseImportRowResult => {
    const errors: string[] = [];

    const occurredAt = resolveDate(row.date, row.time);
    if (!occurredAt) errors.push("Invalid or missing date.");

    const category = resolveCategory(row.category, customCategories);
    if (category === "INVALID") errors.push(`Unknown category "${row.category}" — create it in Expenses first, then re-import.`);

    const amountNum = Number(row.amount);
    const amountValid = row.amount.trim() !== "" && Number.isFinite(amountNum) && amountNum >= 0;
    if (!amountValid) errors.push("Missing or invalid amount.");

    const currency = row.currency.trim() ? row.currency.trim().toUpperCase() : "INR";
    const currencyValid = SUPPORTED_CURRENCIES.includes(currency);
    if (!currencyValid) errors.push(`Invalid currency "${row.currency}".`);

    let partyUserId: string | null = null;
    let partyLabel: string | null = null;
    if (row.party.trim()) {
      const needle = row.party.trim().toLowerCase();
      const matches = partyCandidates.filter((p) => p.companyName === needle || p.name === needle);
      if (matches.length === 0) errors.push(`Unknown Buyer/Supplier "${row.party}".`);
      else if (matches.length > 1) errors.push(`Ambiguous Buyer/Supplier "${row.party}" — ${matches.length} matches found.`);
      else {
        partyUserId = matches[0].id;
        partyLabel = matches[0].label;
      }
    }

    let relatedInvoiceId: string | null = null;
    let relatedInvoiceLabel: string | null = null;
    if (row.invoice.trim()) {
      const candidates = invoiceIndex.get(row.invoice.trim()) ?? [];
      const owned = candidates.filter((c) => c.ownerId === ownerId);
      if (candidates.length === 0) errors.push(`Related invoice "${row.invoice}" not found.`);
      else if (owned.length === 0) errors.push(`Related invoice "${row.invoice}" is not accessible to you.`);
      else if (owned.length > 1) errors.push(`Ambiguous related invoice "${row.invoice}" — multiple matches found.`);
      else {
        relatedInvoiceId = owned[0].id;
        relatedInvoiceLabel = owned[0].invoiceNumber;
      }
    }

    return {
      rowNumber: row.rowNumber,
      raw: row,
      status: errors.length === 0 ? "valid" : "invalid",
      errors,
      resolved: {
        occurredAt,
        location: row.location.trim(),
        category: category === "INVALID" ? null : category.category,
        customCategoryId: category === "INVALID" ? null : category.customCategoryId,
        amount: amountValid ? amountNum.toFixed(2) : null,
        currency: currencyValid ? currency : null,
        notes: row.notes.trim(),
        partyUserId,
        partyLabel,
        relatedInvoiceId,
        relatedInvoiceLabel,
      },
    };
  });
}
