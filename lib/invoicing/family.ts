import type { InvoiceType } from "@/types/invoicing";

/**
 * Classifies each InvoiceType into which "side" it belongs to — drives
 * party role (Buyer vs Supplier) and catalog-integration availability.
 * SALES/PURCHASE remain the underlying symbol names for the original two
 * document types; QUOTATION/CREDIT_NOTE/SALES_RETURN are sales-family,
 * DEBIT_NOTE is purchase-family.
 */
export type InvoiceFamily = "SALES" | "PURCHASE";

export const SALES_FAMILY_TYPES: InvoiceType[] = ["SALES", "QUOTATION", "CREDIT_NOTE", "SALES_RETURN"];
export const PURCHASE_FAMILY_TYPES: InvoiceType[] = ["PURCHASE", "DEBIT_NOTE"];

export function invoiceFamily(type: InvoiceType): InvoiceFamily {
  return PURCHASE_FAMILY_TYPES.includes(type) ? "PURCHASE" : "SALES";
}

export function typesForFamily(family: InvoiceFamily): InvoiceType[] {
  return family === "SALES" ? SALES_FAMILY_TYPES : PURCHASE_FAMILY_TYPES;
}

/** Document types creatable directly from the Create menu (no source document required). */
export const STANDALONE_CREATABLE_TYPES: InvoiceType[] = ["SALES", "PURCHASE", "QUOTATION"];

/** Document types that must be derived from an existing source document. */
export const DEPENDENT_TYPES: InvoiceType[] = ["CREDIT_NOTE", "SALES_RETURN", "DEBIT_NOTE"];

/**
 * Valid (sourceType -> targetType) pairings for the "derive from source"
 * flow — enforced both in the UI (which actions are shown) and server-side
 * (services/invoicing.ts validates this before persisting a dependent
 * document, never trusting the client's target-type selection alone).
 */
export const VALID_DERIVATION_PAIRS: Record<InvoiceType, InvoiceType[]> = {
  SALES: ["CREDIT_NOTE", "SALES_RETURN"],
  PURCHASE: ["DEBIT_NOTE"],
  QUOTATION: ["SALES"],
  CREDIT_NOTE: [],
  SALES_RETURN: [],
  DEBIT_NOTE: [],
};

export function isValidDerivation(sourceType: InvoiceType, targetType: InvoiceType): boolean {
  return VALID_DERIVATION_PAIRS[sourceType]?.includes(targetType) ?? false;
}

/**
 * Parses a `?type=` search param for the create-new-document flow. Only
 * standalone-creatable types are ever valid here — dependent types
 * (Credit Note/Sales Return/Debit Note) always require a `?source=` and are
 * validated against their source's type server-side (see createInvoiceAction).
 */
export function parseStandaloneInvoiceType(raw: string | undefined, hasSource: boolean): InvoiceType {
  const candidates = hasSource ? DEPENDENT_TYPES : STANDALONE_CREATABLE_TYPES;
  if (raw && (candidates as string[]).includes(raw)) return raw as InvoiceType;
  return hasSource ? "CREDIT_NOTE" : "SALES";
}

/**
 * Once the actual source document is known, resolve the requested `?type=`
 * against what's actually valid for that specific source (e.g. a
 * QUOTATION source can only target SALES, not CREDIT_NOTE) — falls back to
 * the first valid target, or null if the source can't derive anything.
 */
export function resolveDerivedType(sourceType: InvoiceType, requested: string | undefined): InvoiceType | null {
  const valid = VALID_DERIVATION_PAIRS[sourceType] ?? [];
  if (valid.length === 0) return null;
  if (requested && (valid as string[]).includes(requested)) return requested as InvoiceType;
  return valid[0];
}
