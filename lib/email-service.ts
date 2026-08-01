// Mock email notifications — swap the body for a real provider (Resend,
// SendGrid, SES) call later; call sites only depend on this function's
// signature, not its internals.

import type { BuyerLeadRecord } from "@/types/buyer-lead";

function mockLatency(ms = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ADMIN_NOTIFICATION_EMAIL = "admin@supplybase.com";

export async function sendBuyerRequirementEmail(lead: BuyerLeadRecord): Promise<{ success: true }> {
  await mockLatency();

  const subject = "New Buyer Requirement Received";
  const body = [
    `Buyer: ${lead.buyerName}`,
    `Company: ${lead.company}`,
    `Requirement: ${lead.requirement}`,
    `Date: ${new Date(lead.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`,
  ].join("\n");

  console.info(`[mock email] To: ${ADMIN_NOTIFICATION_EMAIL}\nSubject: ${subject}\n\n${body}`);

  return { success: true };
}
