"use server";

// Freelancer Portal-side portfolio actions. Every mutation is scoped to the
// signed-in freelancer's own portfolio — ownership is enforced server-side
// via `portfolio: { freelancerId }` relation filters, never trusted from
// the client. Mirrors the requireFreelancer()/deleteMany-with-owner-filter
// pattern already established in services/freelancer.ts.

import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { getUser } from "@/lib/session";
import { validateImage, validateDocumentOrImage } from "@/lib/file-validation";
import { extractDataUrlMeta } from "@/lib/file-validation";
import { isTemplateSelectable } from "@/lib/portfolio-templates";
import { ensurePortfolio, getOwnPortfolioViewModel } from "@/lib/portfolio-queries";
import type { PortfolioViewModel, PortfolioProcessStep, PortfolioTestimonial, PortfolioClient } from "@/types/portfolio";

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

async function requireFreelancer() {
  const user = await getUser();
  if (!user || user.role !== "FREELANCER") return null;
  return user;
}

async function requireOwnFreelancerId(userId: string): Promise<string | null> {
  const freelancer = await db.freelancer.findUnique({ where: { userId }, select: { id: true } });
  return freelancer?.id ?? null;
}

function validateImageDataUrl(dataUrl: string | undefined): { ok: true } | { ok: false; error: string } {
  if (!dataUrl) return { ok: true };
  const { mimeType, sizeBytes } = extractDataUrlMeta(dataUrl);
  const result = validateImage(mimeType, sizeBytes);
  return result.valid ? { ok: true } : { ok: false, error: result.error! };
}

async function reload(userId: string): Promise<PortfolioViewModel> {
  const vm = await getOwnPortfolioViewModel(userId);
  if (!vm) throw new Error("Portfolio not found after mutation");
  return vm;
}

export async function getOwnPortfolioAction(): Promise<ActionResult<PortfolioViewModel>> {
  const user = await requireFreelancer();
  if (!user) return { success: false, error: "You must be signed in as a freelancer." };
  const vm = await getOwnPortfolioViewModel(user.id);
  if (!vm) return { success: false, error: "Freelancer profile not found." };
  return { success: true, data: vm };
}

export async function selectTemplateAction(templateKey: string): Promise<ActionResult<PortfolioViewModel>> {
  const user = await requireFreelancer();
  if (!user) return { success: false, error: "You must be signed in as a freelancer." };
  if (!isTemplateSelectable(templateKey)) return { success: false, error: "That template isn't available yet." };

  const freelancerId = await requireOwnFreelancerId(user.id);
  if (!freelancerId) return { success: false, error: "Freelancer profile not found." };

  await ensurePortfolio(freelancerId);
  await db.freelancerPortfolio.update({ where: { freelancerId }, data: { templateKey } });
  return { success: true, data: await reload(user.id) };
}

export interface UpdatePortfolioContentInput {
  headline?: string;
  tagline?: string;
  aboutLong?: string;
  services?: string[];
  website?: string;
  experienceYears?: number | null;
  processSteps?: PortfolioProcessStep[];
  testimonials?: PortfolioTestimonial[];
  clients?: PortfolioClient[];
}

export async function saveDraftAction(input: UpdatePortfolioContentInput): Promise<ActionResult<PortfolioViewModel>> {
  const user = await requireFreelancer();
  if (!user) return { success: false, error: "You must be signed in as a freelancer." };

  for (const client of input.clients ?? []) {
    const check = validateImageDataUrl(client.logo);
    if (!check.ok) return { success: false, error: check.error };
  }
  for (const testimonial of input.testimonials ?? []) {
    const check = validateImageDataUrl(testimonial.avatar);
    if (!check.ok) return { success: false, error: check.error };
  }

  const freelancerId = await requireOwnFreelancerId(user.id);
  if (!freelancerId) return { success: false, error: "Freelancer profile not found." };

  await ensurePortfolio(freelancerId);
  await db.freelancerPortfolio.update({
    where: { freelancerId },
    data: {
      headline: input.headline !== undefined ? input.headline.trim() || null : undefined,
      tagline: input.tagline !== undefined ? input.tagline.trim() || null : undefined,
      aboutLong: input.aboutLong !== undefined ? input.aboutLong.trim() || null : undefined,
      services: input.services,
      website: input.website !== undefined ? input.website.trim() || null : undefined,
      experienceYears: input.experienceYears !== undefined ? input.experienceYears : undefined,
      processSteps: input.processSteps !== undefined ? (input.processSteps as unknown as Prisma.InputJsonValue) : undefined,
      testimonials: input.testimonials !== undefined ? (input.testimonials as unknown as Prisma.InputJsonValue) : undefined,
      clients: input.clients !== undefined ? (input.clients as unknown as Prisma.InputJsonValue) : undefined,
    },
  });

  return { success: true, data: await reload(user.id) };
}

export async function publishPortfolioAction(): Promise<ActionResult<PortfolioViewModel>> {
  const user = await requireFreelancer();
  if (!user) return { success: false, error: "You must be signed in as a freelancer." };

  const freelancerId = await requireOwnFreelancerId(user.id);
  if (!freelancerId) return { success: false, error: "Freelancer profile not found." };

  await ensurePortfolio(freelancerId);
  const vm = await getOwnPortfolioViewModel(user.id);
  if (!vm) return { success: false, error: "Freelancer profile not found." };

  const missing: string[] = [];
  if (!vm.hero.headline) missing.push("a headline");
  if (!vm.about.short && !vm.about.long) missing.push("an about / bio");
  if (vm.projects.length === 0) missing.push("at least one project");
  if (missing.length > 0) {
    return { success: false, error: `Add ${missing.join(", ")} before publishing.` };
  }

  await db.freelancerPortfolio.update({
    where: { freelancerId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  return { success: true, data: await reload(user.id) };
}

export async function unpublishPortfolioAction(): Promise<ActionResult<PortfolioViewModel>> {
  const user = await requireFreelancer();
  if (!user) return { success: false, error: "You must be signed in as a freelancer." };

  const freelancerId = await requireOwnFreelancerId(user.id);
  if (!freelancerId) return { success: false, error: "Freelancer profile not found." };

  await db.freelancerPortfolio.update({ where: { freelancerId }, data: { status: "DRAFT" } });
  return { success: true, data: await reload(user.id) };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export interface PortfolioProjectInput {
  title: string;
  category?: string;
  description?: string;
  coverImage?: string;
  galleryImages?: string[];
  projectUrl?: string;
  clientName?: string;
  year?: number;
  tools?: string[];
  role?: string;
  featured?: boolean;
}

export async function addProjectAction(input: PortfolioProjectInput): Promise<ActionResult<PortfolioViewModel>> {
  const user = await requireFreelancer();
  if (!user) return { success: false, error: "You must be signed in as a freelancer." };
  if (!input.title.trim()) return { success: false, error: "Project title is required." };

  const coverCheck = validateImageDataUrl(input.coverImage);
  if (!coverCheck.ok) return { success: false, error: coverCheck.error };
  for (const img of input.galleryImages ?? []) {
    const check = validateImageDataUrl(img);
    if (!check.ok) return { success: false, error: check.error };
  }

  const freelancerId = await requireOwnFreelancerId(user.id);
  if (!freelancerId) return { success: false, error: "Freelancer profile not found." };

  const portfolioId = await ensurePortfolio(freelancerId);
  const count = await db.portfolioProject.count({ where: { portfolioId } });

  await db.portfolioProject.create({
    data: {
      portfolioId,
      title: input.title.trim(),
      category: input.category?.trim() || null,
      description: input.description?.trim() || null,
      coverImage: input.coverImage || null,
      galleryImages: input.galleryImages ?? [],
      projectUrl: input.projectUrl?.trim() || null,
      clientName: input.clientName?.trim() || null,
      year: input.year ?? null,
      tools: input.tools ?? [],
      role: input.role?.trim() || null,
      featured: input.featured ?? false,
      position: count,
    },
  });

  return { success: true, data: await reload(user.id) };
}

export async function updateProjectAction(
  projectId: string,
  input: PortfolioProjectInput
): Promise<ActionResult<PortfolioViewModel>> {
  const user = await requireFreelancer();
  if (!user) return { success: false, error: "You must be signed in as a freelancer." };
  if (!input.title.trim()) return { success: false, error: "Project title is required." };

  const coverCheck = validateImageDataUrl(input.coverImage);
  if (!coverCheck.ok) return { success: false, error: coverCheck.error };
  for (const img of input.galleryImages ?? []) {
    const check = validateImageDataUrl(img);
    if (!check.ok) return { success: false, error: check.error };
  }

  const freelancerId = await requireOwnFreelancerId(user.id);
  if (!freelancerId) return { success: false, error: "Freelancer profile not found." };

  await db.portfolioProject.updateMany({
    where: { id: projectId, portfolio: { freelancerId } },
    data: {
      title: input.title.trim(),
      category: input.category?.trim() || null,
      description: input.description?.trim() || null,
      coverImage: input.coverImage || null,
      galleryImages: input.galleryImages ?? [],
      projectUrl: input.projectUrl?.trim() || null,
      clientName: input.clientName?.trim() || null,
      year: input.year ?? null,
      tools: input.tools ?? [],
      role: input.role?.trim() || null,
      featured: input.featured ?? false,
    },
  });

  return { success: true, data: await reload(user.id) };
}

export async function deleteProjectAction(projectId: string): Promise<ActionResult<PortfolioViewModel>> {
  const user = await requireFreelancer();
  if (!user) return { success: false, error: "You must be signed in as a freelancer." };

  const freelancerId = await requireOwnFreelancerId(user.id);
  if (!freelancerId) return { success: false, error: "Freelancer profile not found." };

  await db.portfolioProject.deleteMany({ where: { id: projectId, portfolio: { freelancerId } } });
  return { success: true, data: await reload(user.id) };
}

export async function reorderProjectsAction(orderedIds: string[]): Promise<ActionResult<PortfolioViewModel>> {
  const user = await requireFreelancer();
  if (!user) return { success: false, error: "You must be signed in as a freelancer." };

  const freelancerId = await requireOwnFreelancerId(user.id);
  if (!freelancerId) return { success: false, error: "Freelancer profile not found." };

  await Promise.all(
    orderedIds.map((id, position) =>
      db.portfolioProject.updateMany({ where: { id, portfolio: { freelancerId } }, data: { position } })
    )
  );

  return { success: true, data: await reload(user.id) };
}

// ---------------------------------------------------------------------------
// Boards & pins
// ---------------------------------------------------------------------------

export interface PortfolioBoardInput {
  title: string;
  description?: string;
  coverImage?: string;
}

export async function addBoardAction(input: PortfolioBoardInput): Promise<ActionResult<PortfolioViewModel>> {
  const user = await requireFreelancer();
  if (!user) return { success: false, error: "You must be signed in as a freelancer." };
  if (!input.title.trim()) return { success: false, error: "Board title is required." };

  const coverCheck = validateImageDataUrl(input.coverImage);
  if (!coverCheck.ok) return { success: false, error: coverCheck.error };

  const freelancerId = await requireOwnFreelancerId(user.id);
  if (!freelancerId) return { success: false, error: "Freelancer profile not found." };

  const portfolioId = await ensurePortfolio(freelancerId);
  const count = await db.portfolioBoard.count({ where: { portfolioId } });

  await db.portfolioBoard.create({
    data: {
      portfolioId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      coverImage: input.coverImage || null,
      position: count,
    },
  });

  return { success: true, data: await reload(user.id) };
}

export async function updateBoardAction(
  boardId: string,
  input: PortfolioBoardInput
): Promise<ActionResult<PortfolioViewModel>> {
  const user = await requireFreelancer();
  if (!user) return { success: false, error: "You must be signed in as a freelancer." };
  if (!input.title.trim()) return { success: false, error: "Board title is required." };

  const coverCheck = validateImageDataUrl(input.coverImage);
  if (!coverCheck.ok) return { success: false, error: coverCheck.error };

  const freelancerId = await requireOwnFreelancerId(user.id);
  if (!freelancerId) return { success: false, error: "Freelancer profile not found." };

  await db.portfolioBoard.updateMany({
    where: { id: boardId, portfolio: { freelancerId } },
    data: {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      coverImage: input.coverImage || null,
    },
  });

  return { success: true, data: await reload(user.id) };
}

export async function deleteBoardAction(boardId: string): Promise<ActionResult<PortfolioViewModel>> {
  const user = await requireFreelancer();
  if (!user) return { success: false, error: "You must be signed in as a freelancer." };

  const freelancerId = await requireOwnFreelancerId(user.id);
  if (!freelancerId) return { success: false, error: "Freelancer profile not found." };

  await db.portfolioBoard.deleteMany({ where: { id: boardId, portfolio: { freelancerId } } });
  return { success: true, data: await reload(user.id) };
}

export interface PortfolioPinInput {
  title?: string;
  description?: string;
  image: string;
  externalUrl?: string;
}

export async function addPinAction(boardId: string, input: PortfolioPinInput): Promise<ActionResult<PortfolioViewModel>> {
  const user = await requireFreelancer();
  if (!user) return { success: false, error: "You must be signed in as a freelancer." };

  const { mimeType, sizeBytes } = extractDataUrlMeta(input.image);
  const validation = validateDocumentOrImage(mimeType, sizeBytes);
  if (!validation.valid) return { success: false, error: validation.error! };

  const freelancerId = await requireOwnFreelancerId(user.id);
  if (!freelancerId) return { success: false, error: "Freelancer profile not found." };

  const board = await db.portfolioBoard.findFirst({ where: { id: boardId, portfolio: { freelancerId } }, select: { id: true } });
  if (!board) return { success: false, error: "Board not found." };

  const count = await db.portfolioPin.count({ where: { boardId } });
  await db.portfolioPin.create({
    data: {
      boardId,
      title: input.title?.trim() || null,
      description: input.description?.trim() || null,
      image: input.image,
      externalUrl: input.externalUrl?.trim() || null,
      position: count,
    },
  });

  if (count === 0) {
    await db.portfolioBoard.update({ where: { id: boardId }, data: { coverImage: input.image } });
  }

  return { success: true, data: await reload(user.id) };
}

export async function deletePinAction(pinId: string): Promise<ActionResult<PortfolioViewModel>> {
  const user = await requireFreelancer();
  if (!user) return { success: false, error: "You must be signed in as a freelancer." };

  const freelancerId = await requireOwnFreelancerId(user.id);
  if (!freelancerId) return { success: false, error: "Freelancer profile not found." };

  await db.portfolioPin.deleteMany({ where: { id: pinId, board: { portfolio: { freelancerId } } } });
  return { success: true, data: await reload(user.id) };
}
