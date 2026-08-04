"use server";

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { notifyUsers } from "@/lib/notifications";
import { validateImage, validateDocument } from "@/lib/file-validation";
import { createProjectSchema } from "@/lib/validations/project";
import type { ProjectRecord } from "@/types/freelancer-portal";
import type {
  ProjectTimelineStatus,
  ReferenceLinkPlatform,
} from "@/lib/generated/prisma/enums";

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

async function requireAdmin() {
  const user = await getUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export interface FreelancerOption {
  userId: string;
  name: string;
  email: string;
  avatar: string | null;
}

export async function getFreelancerOptionsAction(): Promise<ActionResult<FreelancerOption[]>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admin access required." };

  const rows = await db.user.findMany({
    where: { role: "FREELANCER" },
    select: { id: true, name: true, email: true, avatar: true },
    orderBy: { name: "asc" },
  });

  return { success: true, data: rows.map((r) => ({ userId: r.id, name: r.name, email: r.email, avatar: r.avatar })) };
}

export interface CreateProjectInput {
  name: string;
  clientName: string;
  startDate: string;
  expectedEndDate: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  description?: string;
  freelancerUserId: string;
  status: "UPCOMING" | "ACTIVE" | "COMPLETED";
}

export async function createProjectAction(input: CreateProjectInput): Promise<ActionResult<ProjectRecord>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admin access required." };

  if (!input.name.trim() || !input.clientName.trim()) {
    return { success: false, error: "Project name and client are required." };
  }

  const freelancer = await db.user.findUnique({ where: { id: input.freelancerUserId }, select: { id: true, role: true } });
  if (!freelancer || freelancer.role !== "FREELANCER") {
    return { success: false, error: "Selected freelancer was not found." };
  }

  const project = await db.project.create({
    data: {
      name: input.name.trim(),
      clientName: input.clientName.trim(),
      startDate: new Date(input.startDate),
      expectedEndDate: new Date(input.expectedEndDate),
      priority: input.priority,
      description: input.description?.trim() || null,
      status: input.status,
      freelancerUserId: input.freelancerUserId,
      createdById: admin.id,
    },
    include: { freelancer: { select: { name: true } }, _count: { select: { tasks: true } } },
  });

  await notifyUsers(
    [input.freelancerUserId],
    {
      type: "PROJECT_ASSIGNED",
      title: "New project assigned",
      body: `You've been assigned to "${project.name}" for ${project.clientName}.`,
      link: "/freelancer/projects",
    },
    admin.id
  );

  return {
    success: true,
    data: {
      id: project.id,
      name: project.name,
      clientName: project.clientName,
      startDate: project.startDate.toISOString(),
      expectedEndDate: project.expectedEndDate.toISOString(),
      priority: project.priority,
      description: project.description,
      status: project.status,
      freelancerUserId: project.freelancerUserId,
      freelancerName: project.freelancer.name,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      taskCount: project._count.tasks,
    },
  };
}

// ─── Section 6 — searchable Supply Chain link source ───────────────────────
export interface SupplyChainOption {
  id: string;
  name: string;
  orderNumber: string;
}

export async function getSupplyChainOptionsAction(): Promise<ActionResult<SupplyChainOption[]>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admin access required." };

  const chains = await db.supplyChain.findMany({
    select: { id: true, name: true, orderNumber: true },
    orderBy: { updatedAt: "desc" },
  });

  return { success: true, data: chains };
}

// ─── Full, production Create Project form (Assign → Add Project) ───────────
// Supersedes the plain createProjectAction above for the Add Task → Assign
// flow. createProjectAction is left in place unused rather than removed.

export interface CreateFullProjectInput {
  name: string;
  clientName: string;
  city?: string;
  pointOfContact?: string;
  whatsapp?: string;
  email?: string;
  linkedinUrl?: string;
  notes?: string;

  timeline: { title: string; description?: string; date: string; status: ProjectTimelineStatus }[];

  referenceLinks: { platform: ReferenceLinkPlatform; url: string }[];
  referenceImages: { dataUrl: string; caption?: string; mimeType: string; sizeBytes: number }[];

  documents: { fileName: string; mimeType: string; sizeBytes: number; dataUrl: string }[];

  startDate: string;
  expectedEndDate: string;

  supplyChainId?: string;

  items: {
    category: string;
    name: string;
    quantity: number;
    sizes: string[];
    priceBeforeGst: number;
    priceAfterGst: number;
    shippingCost: number;
    miscCost: number;
    leadTime?: string;
  }[];

  freelancerUserId: string;
  isDraft: boolean;
}

export async function createFullProjectAction(
  input: CreateFullProjectInput
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admin access required." };

  const parsed = createProjectSchema.safeParse({
    name: input.name,
    clientName: input.clientName,
    city: input.city,
    pointOfContact: input.pointOfContact,
    whatsapp: input.whatsapp,
    email: input.email,
    linkedinUrl: input.linkedinUrl,
    notes: input.notes,
    timeline: input.timeline.map((t, i) => ({ id: String(i), ...t })),
    referenceLinks: input.referenceLinks.map((r, i) => ({ id: String(i), ...r })),
    referenceImages: input.referenceImages.map((img, i) => ({ id: String(i), ...img })),
    documents: input.documents.map((doc, i) => ({ id: String(i), ...doc })),
    startDate: input.startDate,
    expectedEndDate: input.expectedEndDate,
    supplyChainId: input.supplyChainId,
    items: input.items.map((it, i) => ({ id: String(i), ...it })),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const data = parsed.data;

  const freelancer = await db.user.findUnique({ where: { id: input.freelancerUserId }, select: { id: true, role: true } });
  if (!freelancer || freelancer.role !== "FREELANCER") {
    return { success: false, error: "Selected freelancer was not found." };
  }

  if (data.supplyChainId) {
    const chain = await db.supplyChain.findUnique({ where: { id: data.supplyChainId }, select: { id: true } });
    if (!chain) return { success: false, error: "Selected supply chain was not found." };
  }

  for (const img of data.referenceImages) {
    const v = validateImage(img.mimeType, img.sizeBytes);
    if (!v.valid) return { success: false, error: v.error! };
  }
  for (const doc of data.documents) {
    const v = validateDocument(doc.mimeType, doc.sizeBytes);
    if (!v.valid) return { success: false, error: v.error! };
  }

  const project = await db.project.create({
    data: {
      name: data.name.trim(),
      clientName: data.clientName.trim(),
      city: data.city?.trim() || null,
      pointOfContact: data.pointOfContact?.trim() || null,
      whatsapp: data.whatsapp?.trim() || null,
      email: data.email?.trim() || null,
      linkedinUrl: data.linkedinUrl?.trim() || null,
      notes: data.notes?.trim() || null,
      startDate: new Date(data.startDate),
      expectedEndDate: new Date(data.expectedEndDate),
      status: input.isDraft ? "UPCOMING" : "ACTIVE",
      isDraft: input.isDraft,
      freelancerUserId: input.freelancerUserId,
      createdById: admin.id,
      supplyChainId: data.supplyChainId || null,
      timeline: {
        create: data.timeline.map((t, i) => ({
          title: t.title.trim(),
          description: t.description?.trim() || null,
          date: new Date(t.date),
          status: t.status,
          order: i,
        })),
      },
      referenceLinks: {
        create: data.referenceLinks.map((r, i) => ({ platform: r.platform, url: r.url.trim(), order: i })),
      },
      referenceImages: {
        create: data.referenceImages.map((img, i) => ({
          dataUrl: img.dataUrl,
          caption: img.caption?.trim() || null,
          order: i,
        })),
      },
      documents: {
        create: data.documents.map((doc) => ({
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          sizeBytes: doc.sizeBytes,
          dataUrl: doc.dataUrl,
        })),
      },
      items: {
        create: data.items.map((it, i) => ({
          category: it.category.trim(),
          name: it.name.trim(),
          quantity: it.quantity,
          sizes: it.sizes,
          priceBeforeGst: it.priceBeforeGst,
          priceAfterGst: it.priceAfterGst,
          shippingCost: it.shippingCost,
          miscCost: it.miscCost,
          leadTime: it.leadTime?.trim() || null,
          order: i,
        })),
      },
    },
    select: { id: true, name: true, clientName: true },
  });

  if (!input.isDraft) {
    await notifyUsers(
      [input.freelancerUserId],
      {
        type: "PROJECT_ASSIGNED",
        title: "New project assigned",
        body: `You've been assigned to "${project.name}" for ${project.clientName}.`,
        link: "/freelancer/projects",
      },
      admin.id
    );
  }

  return { success: true, data: { id: project.id } };
}
