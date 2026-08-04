"use server";

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { validateImage, validateDocument } from "@/lib/file-validation";
import { getFreelancerProfile, getFreelancerDashboardStats } from "@/lib/freelancer-queries";
import type { FreelancerProfile, FreelancerDashboardStats } from "@/types/freelancer-portal";

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

async function requireFreelancer() {
  const user = await getUser();
  if (!user || user.role !== "FREELANCER") return null;
  return user;
}

export async function getOwnProfileAction(): Promise<ActionResult<FreelancerProfile>> {
  const user = await requireFreelancer();
  if (!user) return { success: false, error: "You must be signed in as a freelancer." };

  const profile = await getFreelancerProfile(user.id);
  if (!profile) return { success: false, error: "Freelancer profile not found." };

  return { success: true, data: profile };
}

export async function getDashboardStatsAction(): Promise<ActionResult<FreelancerDashboardStats>> {
  const user = await requireFreelancer();
  if (!user) return { success: false, error: "You must be signed in as a freelancer." };

  const stats = await getFreelancerDashboardStats(user.id);
  return { success: true, data: stats };
}

export interface UpdateProfileInput {
  location?: string;
  phone?: string;
  bio?: string;
  skills?: string[];
  linkedinUrl?: string;
  instagramUrl?: string;
  behanceUrl?: string;
  dribbbleUrl?: string;
  githubUrl?: string;
  availability?: "AVAILABLE" | "BUSY" | "UNAVAILABLE";
}

export async function updateProfileAction(input: UpdateProfileInput): Promise<ActionResult<FreelancerProfile>> {
  const user = await requireFreelancer();
  if (!user) return { success: false, error: "You must be signed in as a freelancer." };

  const freelancer = await db.freelancer.findUnique({ where: { userId: user.id } });
  if (!freelancer) return { success: false, error: "Freelancer profile not found." };

  await db.freelancer.update({
    where: { userId: user.id },
    data: {
      location: input.location?.trim() || null,
      phone: input.phone?.trim() || null,
      bio: input.bio?.trim() || null,
      skills: input.skills ?? undefined,
      linkedinUrl: input.linkedinUrl?.trim() || null,
      instagramUrl: input.instagramUrl?.trim() || null,
      behanceUrl: input.behanceUrl?.trim() || null,
      dribbbleUrl: input.dribbbleUrl?.trim() || null,
      githubUrl: input.githubUrl?.trim() || null,
      availability: input.availability,
    },
  });

  const profile = await getFreelancerProfile(user.id);
  return { success: true, data: profile! };
}

export async function updateAvatarAction(dataUrl: string): Promise<ActionResult<void>> {
  const user = await requireFreelancer();
  if (!user) return { success: false, error: "You must be signed in as a freelancer." };

  const match = /^data:(.+);base64,/.exec(dataUrl);
  const mimeType = match?.[1] ?? "";
  const sizeBytes = Math.round((dataUrl.length * 3) / 4);
  const validation = validateImage(mimeType, sizeBytes);
  if (!validation.valid) return { success: false, error: validation.error! };

  await db.user.update({ where: { id: user.id }, data: { avatar: dataUrl } });
  return { success: true, data: undefined };
}

export async function addPortfolioItemAction(input: {
  dataUrl: string;
  mimeType: string;
  sizeBytes: number;
  caption?: string;
}): Promise<ActionResult<FreelancerProfile>> {
  const user = await requireFreelancer();
  if (!user) return { success: false, error: "You must be signed in as a freelancer." };

  const validation = validateImage(input.mimeType, input.sizeBytes);
  if (!validation.valid) return { success: false, error: validation.error! };

  const freelancer = await db.freelancer.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!freelancer) return { success: false, error: "Freelancer profile not found." };

  const count = await db.freelancerPortfolioItem.count({ where: { freelancerId: freelancer.id } });
  await db.freelancerPortfolioItem.create({
    data: { freelancerId: freelancer.id, dataUrl: input.dataUrl, caption: input.caption?.trim() || null, order: count },
  });

  const profile = await getFreelancerProfile(user.id);
  return { success: true, data: profile! };
}

export async function removePortfolioItemAction(itemId: string): Promise<ActionResult<FreelancerProfile>> {
  const user = await requireFreelancer();
  if (!user) return { success: false, error: "You must be signed in as a freelancer." };

  const freelancer = await db.freelancer.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!freelancer) return { success: false, error: "Freelancer profile not found." };

  await db.freelancerPortfolioItem.deleteMany({ where: { id: itemId, freelancerId: freelancer.id } });

  const profile = await getFreelancerProfile(user.id);
  return { success: true, data: profile! };
}

export async function uploadResumeAction(input: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
}): Promise<ActionResult<FreelancerProfile>> {
  const user = await requireFreelancer();
  if (!user) return { success: false, error: "You must be signed in as a freelancer." };

  const validation = validateDocument(input.mimeType, input.sizeBytes);
  if (!validation.valid) return { success: false, error: validation.error! };

  await db.freelancer.update({
    where: { userId: user.id },
    data: { resumeFileName: input.fileName, resumeDataUrl: input.dataUrl },
  });

  const profile = await getFreelancerProfile(user.id);
  return { success: true, data: profile! };
}

export interface ExperienceInput {
  role: string;
  company: string;
  startDate: string;
  endDate?: string;
  description?: string;
}

export async function addExperienceAction(input: ExperienceInput): Promise<ActionResult<FreelancerProfile>> {
  const user = await requireFreelancer();
  if (!user) return { success: false, error: "You must be signed in as a freelancer." };
  if (!input.role.trim() || !input.company.trim()) return { success: false, error: "Role and company are required." };

  const freelancer = await db.freelancer.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!freelancer) return { success: false, error: "Freelancer profile not found." };

  const count = await db.freelancerExperience.count({ where: { freelancerId: freelancer.id } });
  await db.freelancerExperience.create({
    data: {
      freelancerId: freelancer.id,
      role: input.role.trim(),
      company: input.company.trim(),
      startDate: new Date(input.startDate),
      endDate: input.endDate ? new Date(input.endDate) : null,
      description: input.description?.trim() || null,
      order: count,
    },
  });

  const profile = await getFreelancerProfile(user.id);
  return { success: true, data: profile! };
}

export async function removeExperienceAction(id: string): Promise<ActionResult<FreelancerProfile>> {
  const user = await requireFreelancer();
  if (!user) return { success: false, error: "You must be signed in as a freelancer." };

  const freelancer = await db.freelancer.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!freelancer) return { success: false, error: "Freelancer profile not found." };

  await db.freelancerExperience.deleteMany({ where: { id, freelancerId: freelancer.id } });

  const profile = await getFreelancerProfile(user.id);
  return { success: true, data: profile! };
}
