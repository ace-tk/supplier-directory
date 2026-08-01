// Server-only in-memory "database" for Buyer Leads. Lives for the lifetime
// of the Node process, shared by every request — a buyer's submission from
// the Shop page is immediately visible to the admin's Buyer Leads page.
// Only import this from Server Components / Server Actions (services/buyer-leads.ts);
// never from a "use client" module, or each browser tab gets its own copy.
// Swap the array + functions below for real `db.buyerLead.*` Prisma calls later —
// the function signatures are the contract callers depend on.

import { detectCategory, detectQuantity, detectBudget, detectCountry } from "@/lib/requirement-parser";
import type { BuyerLeadRecord, BuyerLeadStatus } from "@/types/buyer-lead";

function makeId(): string {
  return `lead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function seedLead(
  overrides: Partial<BuyerLeadRecord> & Pick<BuyerLeadRecord, "buyerName" | "company" | "requirement">
): BuyerLeadRecord {
  const now = new Date().toISOString();
  return {
    id: makeId(),
    email: `${overrides.buyerName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    phone: "+91 98765 43210",
    category: detectCategory(overrides.requirement),
    quantity: detectQuantity(overrides.requirement),
    budget: detectBudget(overrides.requirement),
    country: detectCountry(overrides.requirement),
    status: "Pending Verification",
    assignedSupplierIds: [],
    verificationNote: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

let leads: BuyerLeadRecord[] = [
  seedLead({
    buyerName: "Ananya Rao",
    company: "Urban Threads Retail",
    requirement: "I need 500 cotton hoodies for our winter collection, delivery within 3 weeks.",
    status: "Verified",
  }),
  seedLead({
    buyerName: "Marcus Lee",
    company: "Pacific Footwear Co.",
    requirement: "I need 100 sneakers under ₹4,000 per pair for a trial order.",
    status: "Supplier Matching",
    assignedSupplierIds: [],
  }),
  seedLead({
    buyerName: "Fatima Al-Sayed",
    company: "Gulf Kids Fashion LLC",
    requirement: "I need kids wear manufacturers from Tiruppur for a long-term contract.",
    status: "Pending Verification",
  }),
  seedLead({
    buyerName: "David Kim",
    company: "Seoul Leather Imports",
    requirement: "I need leather handbags for export, minimum 200 units per style.",
    status: "Supplier Contacted",
  }),
  seedLead({
    buyerName: "Priya Nair",
    company: "Nair Trading House",
    requirement: "I need 1000 units of women's ethnic wear, budget around ₹600 per piece.",
    status: "Closed",
    verificationNote: "Order fulfilled via Rajasthan Textile Mills.",
  }),
];

export function getAllBuyerLeads(): BuyerLeadRecord[] {
  return [...leads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getBuyerLeadById(id: string): BuyerLeadRecord | null {
  return leads.find((l) => l.id === id) ?? null;
}

export function createBuyerLead(input: {
  buyerName: string;
  company: string;
  email: string;
  phone: string;
  requirement: string;
}): BuyerLeadRecord {
  const now = new Date().toISOString();
  const lead: BuyerLeadRecord = {
    id: makeId(),
    buyerName: input.buyerName,
    company: input.company,
    email: input.email,
    phone: input.phone,
    requirement: input.requirement,
    category: detectCategory(input.requirement),
    quantity: detectQuantity(input.requirement),
    budget: detectBudget(input.requirement),
    country: detectCountry(input.requirement),
    status: "Pending Verification",
    assignedSupplierIds: [],
    verificationNote: null,
    createdAt: now,
    updatedAt: now,
  };
  leads = [lead, ...leads];
  return lead;
}

function touch(lead: BuyerLeadRecord): BuyerLeadRecord {
  lead.updatedAt = new Date().toISOString();
  return lead;
}

export function updateLeadStatus(id: string, status: BuyerLeadStatus): BuyerLeadRecord | null {
  const lead = getBuyerLeadById(id);
  if (!lead) return null;
  lead.status = status;
  return touch(lead);
}

export function verifyLead(id: string): BuyerLeadRecord | null {
  const lead = getBuyerLeadById(id);
  if (!lead) return null;
  lead.status = "Verified";
  lead.verificationNote = null;
  return touch(lead);
}

export function rejectLead(id: string, reason?: string): BuyerLeadRecord | null {
  const lead = getBuyerLeadById(id);
  if (!lead) return null;
  lead.status = "Closed";
  lead.verificationNote = reason?.trim() ? `Rejected: ${reason.trim()}` : "Rejected";
  return touch(lead);
}

export function requestMoreInfo(id: string, note: string): BuyerLeadRecord | null {
  const lead = getBuyerLeadById(id);
  if (!lead) return null;
  lead.verificationNote = `More info requested: ${note.trim()}`;
  return touch(lead);
}

export function assignSuppliers(id: string, supplierIds: string[]): BuyerLeadRecord | null {
  const lead = getBuyerLeadById(id);
  if (!lead) return null;
  lead.assignedSupplierIds = supplierIds;
  if (lead.status === "Verified") lead.status = "Supplier Matching";
  return touch(lead);
}
