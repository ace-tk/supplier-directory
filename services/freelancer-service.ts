"use server";

// Real, DB-backed freelancer list for the Admin → Freelancers module — was a
// mock in-memory service; now sourced from actual registered Freelancer
// accounts (see lib/freelancer-queries.ts) so Add Task/Proposal/Assign reach
// real Freelancer Portal users.

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { getAllFreelancerProfiles, getAllProjects, getPortfolioPreviewsForFreelancers } from "@/lib/freelancer-queries";
import type { FreelancerRecord, PaymentStatus, Availability } from "@/types/freelancer";

function mockLatency(ms = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const AVAILABILITY_MAP: Record<string, Availability> = {
  AVAILABLE: "Available",
  BUSY: "Busy",
  UNAVAILABLE: "Unavailable",
};

const PAYMENT_STATUS_MAP: Record<string, PaymentStatus> = {
  PAID: "Paid",
  PENDING: "Pending",
  OVERDUE: "Overdue",
};

export async function getFreelancers(): Promise<FreelancerRecord[]> {
  const [profiles, projects] = await Promise.all([getAllFreelancerProfiles(), getAllProjects()]);
  const portfolioPreviews = await getPortfolioPreviewsForFreelancers(profiles.map((p) => p.id));

  return profiles.map((p) => {
    const ownProjects = projects.filter((pr) => pr.freelancerUserId === p.userId);
    const activeProjects = ownProjects.filter((pr) => pr.status === "ACTIVE").length;
    const assignedClients = [...new Set(ownProjects.map((pr) => pr.clientName))];

    return {
      id: p.userId,
      name: p.name,
      email: p.email,
      avatar: p.avatar,
      location: p.location,
      phone: p.phone,
      linkedinUrl: p.linkedinUrl,
      instagramUrl: p.instagramUrl,
      role: p.experience[0]?.role ?? null,
      bio: p.bio,
      skills: p.skills,
      assignedClients,
      assignedSuppliers: [],
      activeProjects,
      paymentStatus: PAYMENT_STATUS_MAP[p.paymentStatus] ?? "Pending",
      performanceScore: p.performanceScore,
      availability: AVAILABILITY_MAP[p.availability] ?? "Available",
      status: p.status === "DEACTIVATED" ? "Deactivated" : "Active",
      portfolioPreviewImages: portfolioPreviews.get(p.id) ?? [],
    };
  });
}

// Legacy entry point kept for the original mock Assign Task dialog — no
// longer wired to any button (superseded by the real Proposal/Add Project
// flow in components/admin/freelancers/add-task-dialog.tsx) but left intact
// per "don't remove existing components."
export async function assignTask(
  freelancerId: string,
  payload: { clientOrSupplier: string; taskTitle: string }
): Promise<{ success: true }> {
  await mockLatency(700);
  console.info("[mock] task assigned", freelancerId, payload);
  return { success: true };
}

export async function deactivateFreelancer(userId: string): Promise<{ success: true; status: "Active" | "Deactivated" }> {
  const admin = await getUser();
  if (!admin || admin.role !== "ADMIN") return { success: true, status: "Active" };

  const freelancer = await db.freelancer.findUnique({ where: { userId }, select: { status: true } });
  if (!freelancer) return { success: true, status: "Active" };

  const nextStatus = freelancer.status === "ACTIVE" ? "DEACTIVATED" : "ACTIVE";
  await db.freelancer.update({ where: { userId }, data: { status: nextStatus } });

  return { success: true, status: nextStatus === "ACTIVE" ? "Active" : "Deactivated" };
}
