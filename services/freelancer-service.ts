"use server";

// Real, DB-backed freelancer list for the Admin → Freelancers module — was a
// mock in-memory service; now sourced from actual registered Freelancer
// accounts (see lib/freelancer-queries.ts) so Add Task/Proposal/Assign reach
// real Freelancer Portal users.

import crypto from "crypto";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { getUser } from "@/lib/session";
import { hashPassword } from "@/lib/auth";
import { validateImage, extractDataUrlMeta } from "@/lib/file-validation";
import { preparePasswordResetToken } from "@/lib/password-reset";
import { createFreelancerSchema, type CreateFreelancerFormValues } from "@/lib/validations/freelancer-admin";
import { getAllFreelancerProfiles, getAllProjects, getPortfolioPreviewsForFreelancers } from "@/lib/freelancer-queries";
import type { FreelancerRecord, PaymentStatus, Availability } from "@/types/freelancer";

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

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

/**
 * Real Admin-created freelancer. Follows the exact same User+Freelancer
 * shape as self-service signup (services/auth.ts signupAction) via a single
 * Prisma nested write — Prisma wraps nested writes in an implicit
 * transaction, so there is no orphan-User risk if a nested create fails.
 *
 * The account is given a random password nobody (including the Admin who
 * created it) ever sees or stores in plain text — it is not a usable
 * credential. The only real way in is the single-use activation token
 * created in that same nested write, whose raw value is returned once to the Admin so
 * they can hand the link to the freelancer directly (no email provider
 * exists in this codebase — see reset-password's page comment).
 */
export async function createFreelancerAction(
  input: CreateFreelancerFormValues
): Promise<ActionResult<{ userId: string; resetToken: string }>> {
  const admin = await getUser();
  if (!admin || admin.role !== "ADMIN") {
    return { success: false, error: "Only admins can add freelancers." };
  }

  const parsed = createFreelancerSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const data = parsed.data;

  if (data.avatarDataUrl) {
    const { mimeType, sizeBytes } = extractDataUrlMeta(data.avatarDataUrl);
    const validation = validateImage(mimeType, sizeBytes);
    if (!validation.valid) return { success: false, error: validation.error! };
  }

  const existing = await db.user.findUnique({ where: { email: data.email }, select: { role: true } });
  if (existing) {
    return {
      success: false,
      error:
        existing.role === "FREELANCER"
          ? "A freelancer with this email already exists."
          : "A user with this email already exists.",
    };
  }

  const randomPassword = crypto.randomBytes(32).toString("hex");
  const hashedPassword = await hashPassword(randomPassword);
  const activation = preparePasswordResetToken();

  try {
    const user = await db.user.create({
      data: {
        name: data.name.trim(),
        email: data.email.trim(),
        password: hashedPassword,
        role: "FREELANCER",
        avatar: data.avatarDataUrl || null,
        passwordResetTokens: {
          create: {
            tokenHash: activation.tokenHash,
            expiresAt: activation.expiresAt,
          },
        },
        freelancer: {
          create: {
            phone: data.phone?.trim() || null,
            location: data.location?.trim() || null,
            bio: data.bio?.trim() || null,
            skills: data.skills,
            availability: data.availability,
            linkedinUrl: data.linkedinUrl || null,
            instagramUrl: data.instagramUrl || null,
            behanceUrl: data.behanceUrl || null,
            dribbbleUrl: data.dribbbleUrl || null,
            githubUrl: data.githubUrl || null,
            ...(data.role?.trim()
              ? {
                  experience: {
                    create: {
                      role: data.role.trim(),
                      company: data.company?.trim() || "Independent",
                      startDate: new Date(),
                      order: 0,
                    },
                  },
                }
              : {}),
          },
        },
      },
      select: { id: true },
    });
    return { success: true, data: { userId: user.id, resetToken: activation.rawToken } };
  } catch (err) {
    // Email uniqueness is already checked above, but re-guard against a
    // race (two admins submitting the same email at once) rather than
    // surfacing a raw Prisma error.
    console.error("[createFreelancerAction]", err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { success: false, error: "A user with this email already exists." };
    }
    return { success: false, error: "The freelancer could not be created. Please try again." };
  }
}
