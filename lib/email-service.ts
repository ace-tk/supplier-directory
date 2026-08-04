// Mock email notifications — swap the body for a real provider (Resend,
// SendGrid, SES) call later; call sites only depend on this function's
// signature, not its internals.

import type { BuyerLeadRecord } from "@/types/buyer-lead";
import type { ProposalChannel } from "@/lib/generated/prisma/enums";

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

interface ProposalMessageInput {
  freelancerName: string;
  freelancerEmail: string;
  freelancerPhone: string | null;
  title: string;
  clientName: string;
  description: string | null;
  channel: ProposalChannel;
}

export async function sendProposalMessage(input: ProposalMessageInput): Promise<{ success: true }> {
  await mockLatency();

  const body = [
    `Project: ${input.title}`,
    `Client: ${input.clientName}`,
    input.description ? `Details: ${input.description}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  if (input.channel === "EMAIL" || input.channel === "BOTH") {
    console.info(`[mock email] To: ${input.freelancerEmail}\nSubject: New Proposal — ${input.title}\n\n${body}`);
  }
  if (input.channel === "WHATSAPP" || input.channel === "BOTH") {
    console.info(`[mock whatsapp] To: ${input.freelancerPhone ?? "(no phone on file)"}\n\n${body}`);
  }

  return { success: true };
}

interface InvoiceEmailInput {
  recipientLabel: string;
  invoiceNumber: string;
  amount: number;
  currency?: string;
  dueDate: string;
}

export async function sendInvoiceEmail(input: InvoiceEmailInput): Promise<{ success: true }> {
  await mockLatency();

  const subject = `Invoice ${input.invoiceNumber}`;
  const body = [
    `To: ${input.recipientLabel}`,
    `Amount: ${input.currency ?? "INR"} ${input.amount.toLocaleString("en-IN")}`,
    `Due: ${new Date(input.dueDate).toLocaleDateString("en-IN", { dateStyle: "medium" })}`,
  ].join("\n");

  console.info(`[mock email] ${subject}\n${body}`);

  return { success: true };
}
