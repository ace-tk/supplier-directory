// Real, DB-backed read layer for the Freelancer Portal and the Admin →
// Freelancers module. Mirrors the pattern established in
// lib/supply-chain-queries.ts — every read maps Prisma rows to the plain
// types in types/freelancer-portal.ts.

import { db } from "@/lib/db";
import type {
  FreelancerProfile,
  ProjectRecord,
  FreelancerTaskRecord,
  ProposalRecord,
  FreelancerDashboardStats,
} from "@/types/freelancer-portal";

const profileInclude = {
  user: { select: { id: true, name: true, email: true, avatar: true } },
  portfolioItems: { orderBy: { order: "asc" as const } },
  experience: { orderBy: { order: "asc" as const } },
};

type FreelancerWithRelations = NonNullable<Awaited<ReturnType<typeof fetchFreelancerRaw>>>;

function fetchFreelancerRaw(userId: string) {
  return db.freelancer.findUnique({ where: { userId }, include: profileInclude });
}

function mapFreelancer(f: FreelancerWithRelations): FreelancerProfile {
  return {
    id: f.id,
    userId: f.userId,
    name: f.user.name,
    email: f.user.email,
    avatar: f.user.avatar,
    location: f.location,
    phone: f.phone,
    bio: f.bio,
    skills: f.skills,
    linkedinUrl: f.linkedinUrl,
    instagramUrl: f.instagramUrl,
    behanceUrl: f.behanceUrl,
    dribbbleUrl: f.dribbbleUrl,
    githubUrl: f.githubUrl,
    resumeFileName: f.resumeFileName,
    resumeDataUrl: f.resumeDataUrl,
    availability: f.availability,
    status: f.status,
    paymentStatus: f.paymentStatus,
    performanceScore: f.performanceScore,
    createdAt: f.createdAt.toISOString(),
    portfolioItems: f.portfolioItems.map((p) => ({
      id: p.id,
      caption: p.caption,
      dataUrl: p.dataUrl,
      order: p.order,
      createdAt: p.createdAt.toISOString(),
    })),
    experience: f.experience.map((e) => ({
      id: e.id,
      role: e.role,
      company: e.company,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate ? e.endDate.toISOString() : null,
      description: e.description,
      order: e.order,
    })),
  };
}

export async function getFreelancerProfile(userId: string): Promise<FreelancerProfile | null> {
  const raw = await fetchFreelancerRaw(userId);
  return raw ? mapFreelancer(raw) : null;
}

export async function getAllFreelancerProfiles(): Promise<FreelancerProfile[]> {
  const rows = await db.freelancer.findMany({ include: profileInclude, orderBy: { createdAt: "desc" } });
  return rows.map(mapFreelancer);
}

/**
 * Up to 6 real cover images per freelancer's *published* portfolio, for the
 * Admin Freelancers grid's compact preview strip (rendered 3 at a time with
 * real next/prev pagination when more than 3 exist). One query for every
 * freelancer on the page — Prisma's nested-relation `take` limits it to 6
 * PortfolioProject rows per freelancer server-side, so this never fetches
 * every project/board/pin and never turns into N+1 as the roster grows.
 * Freelancers with no FreelancerPortfolio row, or one still in DRAFT,
 * simply have no entry in the returned map.
 */
export async function getPortfolioPreviewsForFreelancers(
  freelancerIds: string[]
): Promise<Map<string, string[]>> {
  if (freelancerIds.length === 0) return new Map();

  const rows = await db.freelancerPortfolio.findMany({
    where: { freelancerId: { in: freelancerIds }, status: "PUBLISHED" },
    select: {
      freelancerId: true,
      projects: {
        where: { coverImage: { not: null } },
        orderBy: { position: "asc" },
        take: 6,
        select: { coverImage: true },
      },
    },
  });

  const map = new Map<string, string[]>();
  for (const row of rows) {
    const images = row.projects.map((p) => p.coverImage).filter((img): img is string => Boolean(img));
    if (images.length > 0) map.set(row.freelancerId, images);
  }
  return map;
}

function mapProject(p: {
  id: string;
  name: string;
  clientName: string;
  startDate: Date;
  expectedEndDate: Date;
  priority: ProjectRecord["priority"];
  description: string | null;
  status: ProjectRecord["status"];
  freelancerUserId: string;
  freelancer: { name: string };
  createdAt: Date;
  updatedAt: Date;
  _count: { tasks: number };
}): ProjectRecord {
  return {
    id: p.id,
    name: p.name,
    clientName: p.clientName,
    startDate: p.startDate.toISOString(),
    expectedEndDate: p.expectedEndDate.toISOString(),
    priority: p.priority,
    description: p.description,
    status: p.status,
    freelancerUserId: p.freelancerUserId,
    freelancerName: p.freelancer.name,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    taskCount: p._count.tasks,
  };
}

export async function getProjectsForFreelancer(userId: string): Promise<ProjectRecord[]> {
  const rows = await db.project.findMany({
    where: { freelancerUserId: userId, isDraft: false },
    include: { freelancer: { select: { name: true } }, _count: { select: { tasks: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(mapProject);
}

export async function getAllProjects(): Promise<ProjectRecord[]> {
  const rows = await db.project.findMany({
    where: { isDraft: false },
    include: { freelancer: { select: { name: true } }, _count: { select: { tasks: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(mapProject);
}

function mapTask(t: {
  id: string;
  title: string;
  dueDate: Date;
  priority: FreelancerTaskRecord["priority"];
  status: FreelancerTaskRecord["status"];
  projectId: string | null;
  project: { name: string } | null;
  freelancerUserId: string;
  createdAt: Date;
}): FreelancerTaskRecord {
  return {
    id: t.id,
    title: t.title,
    dueDate: t.dueDate.toISOString(),
    priority: t.priority,
    status: t.status,
    projectId: t.projectId,
    projectName: t.project?.name ?? null,
    freelancerUserId: t.freelancerUserId,
    createdAt: t.createdAt.toISOString(),
  };
}

export async function getTasksForFreelancer(userId: string): Promise<FreelancerTaskRecord[]> {
  const rows = await db.freelancerTask.findMany({
    where: { freelancerUserId: userId },
    include: { project: { select: { name: true } } },
    orderBy: { dueDate: "asc" },
  });
  return rows.map(mapTask);
}

function mapProposal(p: {
  id: string;
  title: string;
  clientName: string;
  description: string | null;
  channel: ProposalRecord["channel"];
  status: ProposalRecord["status"];
  freelancerUserId: string;
  freelancer: { name: string };
  createdBy: { name: string };
  createdAt: Date;
}): ProposalRecord {
  return {
    id: p.id,
    title: p.title,
    clientName: p.clientName,
    description: p.description,
    channel: p.channel,
    status: p.status,
    freelancerUserId: p.freelancerUserId,
    freelancerName: p.freelancer.name,
    createdByName: p.createdBy.name,
    createdAt: p.createdAt.toISOString(),
  };
}

export async function getProposalsForFreelancer(userId: string): Promise<ProposalRecord[]> {
  const rows = await db.proposal.findMany({
    where: { freelancerUserId: userId },
    include: { freelancer: { select: { name: true } }, createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapProposal);
}

export async function getAllProposals(): Promise<ProposalRecord[]> {
  const rows = await db.proposal.findMany({
    include: { freelancer: { select: { name: true } }, createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapProposal);
}

export async function getFreelancerDashboardStats(userId: string): Promise<FreelancerDashboardStats> {
  const [activeProjects, pendingProposals, assignedTasks, completedProjects, unreadNotifications] = await Promise.all([
    db.project.count({ where: { freelancerUserId: userId, status: "ACTIVE" } }),
    db.proposal.count({ where: { freelancerUserId: userId, status: "SENT" } }),
    db.freelancerTask.count({ where: { freelancerUserId: userId, status: { not: "COMPLETED" } } }),
    db.project.count({ where: { freelancerUserId: userId, status: "COMPLETED" } }),
    db.notification.count({ where: { userId, read: false } }),
  ]);

  return { activeProjects, pendingProposals, assignedTasks, completedProjects, unreadNotifications };
}
