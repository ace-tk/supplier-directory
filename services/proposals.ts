"use server";

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { notifyUsers } from "@/lib/notifications";
import { sendProposalMessage } from "@/lib/email-service";
import type { ProposalRecord } from "@/types/freelancer-portal";

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

async function requireAdmin() {
  const user = await getUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export interface CreateProposalInput {
  freelancerUserId: string;
  title: string;
  clientName: string;
  description?: string;
  channel: "EMAIL" | "WHATSAPP" | "BOTH";
}

export async function createProposalAction(input: CreateProposalInput): Promise<ActionResult<ProposalRecord>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admin access required." };

  if (!input.title.trim() || !input.clientName.trim()) {
    return { success: false, error: "Proposal title and client are required." };
  }

  const freelancerUser = await db.user.findUnique({
    where: { id: input.freelancerUserId },
    select: { id: true, name: true, email: true, role: true, freelancer: { select: { phone: true } } },
  });
  if (!freelancerUser || freelancerUser.role !== "FREELANCER") {
    return { success: false, error: "Selected freelancer was not found." };
  }

  const proposal = await db.proposal.create({
    data: {
      freelancerUserId: input.freelancerUserId,
      createdById: admin.id,
      title: input.title.trim(),
      clientName: input.clientName.trim(),
      description: input.description?.trim() || null,
      channel: input.channel,
    },
    include: { freelancer: { select: { name: true } }, createdBy: { select: { name: true } } },
  });

  await sendProposalMessage({
    freelancerName: freelancerUser.name,
    freelancerEmail: freelancerUser.email,
    freelancerPhone: freelancerUser.freelancer?.phone ?? null,
    title: proposal.title,
    clientName: proposal.clientName,
    description: proposal.description,
    channel: proposal.channel,
  });

  await notifyUsers(
    [input.freelancerUserId],
    {
      type: "PROPOSAL_RECEIVED",
      title: "New proposal received",
      body: `New proposal "${proposal.title}" from ${proposal.clientName}.`,
      link: "/freelancer/proposals",
    },
    admin.id
  );

  return {
    success: true,
    data: {
      id: proposal.id,
      title: proposal.title,
      clientName: proposal.clientName,
      description: proposal.description,
      channel: proposal.channel,
      status: proposal.status,
      freelancerUserId: proposal.freelancerUserId,
      freelancerName: proposal.freelancer.name,
      createdByName: proposal.createdBy.name,
      createdAt: proposal.createdAt.toISOString(),
    },
  };
}

export async function sendAdminMessageAction(input: {
  freelancerUserId: string;
  message: string;
}): Promise<ActionResult<void>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admin access required." };
  if (!input.message.trim()) return { success: false, error: "Message cannot be empty." };

  await notifyUsers(
    [input.freelancerUserId],
    {
      type: "ADMIN_MESSAGE",
      title: "Message from Admin",
      body: input.message.trim(),
      link: "/freelancer/notifications",
    },
    admin.id
  );

  return { success: true, data: undefined };
}
