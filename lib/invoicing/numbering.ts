import { db } from "@/lib/db";
import type { InvoiceType } from "@/lib/generated/prisma/enums";

/**
 * Per-owner, per-type, per-year invoice numbering: INV-2026-0001 (Sales) /
 * PUR-2026-0001 (Purchase). Prefix map is kept isolated here so a
 * per-owner configurable-prefix setting can be introduced in Phase 2
 * without changing the InvoiceCounter model's shape.
 */
const NUMBER_PREFIX: Record<InvoiceType, string> = {
  SALES: "INV",
  PURCHASE: "PUR",
  QUOTATION: "QUO",
  CREDIT_NOTE: "CN",
  SALES_RETURN: "SR",
  DEBIT_NOTE: "DN",
};

function formatInvoiceNumber(type: InvoiceType, year: number, sequence: number): string {
  return `${NUMBER_PREFIX[type]}-${year}-${String(sequence).padStart(4, "0")}`;
}

/** Read-only preview of the next number, for prefilling the create form. Does not consume the sequence. */
export async function previewNextInvoiceNumber(
  ownerId: string,
  type: InvoiceType,
  date: Date = new Date()
): Promise<string> {
  const year = date.getFullYear();
  const counter = await db.invoiceCounter.findUnique({
    where: { ownerId_type_year: { ownerId, type, year } },
  });
  return formatInvoiceNumber(type, year, (counter?.lastNumber ?? 0) + 1);
}

/**
 * Atomically consumes the next number in the sequence. Compiles to a
 * single INSERT ... ON CONFLICT DO UPDATE, so it's safe under concurrent
 * invoice creation without an explicit transaction or row lock.
 */
export async function consumeNextInvoiceNumber(
  ownerId: string,
  type: InvoiceType,
  date: Date = new Date()
): Promise<string> {
  const year = date.getFullYear();
  const counter = await db.invoiceCounter.upsert({
    where: { ownerId_type_year: { ownerId, type, year } },
    create: { ownerId, type, year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return formatInvoiceNumber(type, year, counter.lastNumber);
}
