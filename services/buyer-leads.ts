"use server";

import { getUser } from "@/lib/session";
import { db } from "@/lib/db";
import * as store from "@/lib/buyer-leads-store";
import { sendBuyerRequirementEmail } from "@/lib/email-service";
import type { BuyerLeadRecord, BuyerLeadStatus } from "@/types/buyer-lead";

export type BuyerLeadActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function getBuyerContactDetails(): Promise<{ name: string; email: string; company: string } | null> {
  const user = await getUser();
  if (!user) return null;
  const buyer = await db.buyer.findUnique({ where: { userId: user.id } });
  return { name: user.name, email: user.email, company: buyer?.companyName ?? "" };
}

export async function submitBuyerRequirement(input: {
  company: string;
  phone: string;
  requirement: string;
}): Promise<BuyerLeadActionResult<{ leadId: string }>> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in to submit a requirement." };
  if (user.role !== "BUYER") return { success: false, error: "Only buyer accounts can submit sourcing requests." };
  if (!input.company.trim() || !input.phone.trim() || !input.requirement.trim()) {
    return { success: false, error: "Company, phone, and requirement are all required." };
  }

  const lead = store.createBuyerLead({
    buyerName: user.name,
    company: input.company.trim(),
    email: user.email,
    phone: input.phone.trim(),
    requirement: input.requirement.trim(),
  });

  await sendBuyerRequirementEmail(lead);

  return { success: true, data: { leadId: lead.id } };
}

export async function updateBuyerLeadStatus(
  id: string,
  status: BuyerLeadStatus
): Promise<BuyerLeadActionResult<BuyerLeadRecord>> {
  const lead = store.updateLeadStatus(id, status);
  if (!lead) return { success: false, error: "Lead not found." };
  return { success: true, data: lead };
}

export async function verifyBuyerLead(id: string): Promise<BuyerLeadActionResult<BuyerLeadRecord>> {
  const lead = store.verifyLead(id);
  if (!lead) return { success: false, error: "Lead not found." };
  return { success: true, data: lead };
}

export async function rejectBuyerLead(id: string, reason?: string): Promise<BuyerLeadActionResult<BuyerLeadRecord>> {
  const lead = store.rejectLead(id, reason);
  if (!lead) return { success: false, error: "Lead not found." };
  return { success: true, data: lead };
}

export async function requestMoreInfoAction(id: string, note: string): Promise<BuyerLeadActionResult<BuyerLeadRecord>> {
  const lead = store.requestMoreInfo(id, note);
  if (!lead) return { success: false, error: "Lead not found." };
  return { success: true, data: lead };
}

export async function assignSuppliersToLead(
  id: string,
  supplierIds: string[]
): Promise<BuyerLeadActionResult<BuyerLeadRecord>> {
  const lead = store.assignSuppliers(id, supplierIds);
  if (!lead) return { success: false, error: "Lead not found." };
  return { success: true, data: lead };
}
