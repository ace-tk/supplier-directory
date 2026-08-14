// Read layer for the Freelancer Portfolio system. Single source of truth:
// name/avatar/role/location/availability/skills/socials are always read
// live off Freelancer/User here, never duplicated onto FreelancerPortfolio —
// so an edit to the freelancer's profile is reflected everywhere (admin
// card, builder preview, published site) without any manual sync step.

import { db } from "@/lib/db";
import type {
  PortfolioViewModel,
  PortfolioProjectVM,
  PortfolioBoardVM,
  PortfolioProcessStep,
  PortfolioTestimonial,
  PortfolioClient,
} from "@/types/portfolio";

const AVAILABILITY_LABEL: Record<string, string> = {
  AVAILABLE: "Available",
  BUSY: "Busy",
  UNAVAILABLE: "Unavailable",
};

const portfolioInclude = {
  freelancer: {
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true } },
      experience: { orderBy: { order: "asc" as const }, take: 1 },
    },
  },
  projects: { orderBy: { position: "asc" as const } },
  boards: {
    orderBy: { position: "asc" as const },
    include: { pins: { orderBy: { position: "asc" as const } } },
  },
};

type PortfolioWithRelations = NonNullable<Awaited<ReturnType<typeof fetchPortfolioRaw>>>;

function fetchPortfolioRaw(freelancerId: string) {
  return db.freelancerPortfolio.findUnique({ where: { freelancerId }, include: portfolioInclude });
}

async function getAssignedClientCount(userId: string): Promise<number> {
  const rows = await db.project.findMany({
    where: { freelancerUserId: userId, isDraft: false },
    select: { clientName: true },
    distinct: ["clientName"],
  });
  return rows.length;
}

function mapProject(p: PortfolioWithRelations["projects"][number]): PortfolioProjectVM {
  return {
    id: p.id,
    title: p.title,
    category: p.category,
    description: p.description,
    coverImage: p.coverImage,
    galleryImages: p.galleryImages,
    projectUrl: p.projectUrl,
    clientName: p.clientName,
    year: p.year,
    tools: p.tools,
    role: p.role,
    featured: p.featured,
    position: p.position,
  };
}

function mapBoard(b: PortfolioWithRelations["boards"][number]): PortfolioBoardVM {
  return {
    id: b.id,
    title: b.title,
    description: b.description,
    coverImage: b.coverImage,
    pins: b.pins.map((pin) => ({
      id: pin.id,
      title: pin.title,
      description: pin.description,
      image: pin.image,
      externalUrl: pin.externalUrl,
      position: pin.position,
    })),
  };
}

function asProcessSteps(json: unknown): PortfolioProcessStep[] {
  if (!Array.isArray(json)) return [];
  return json as PortfolioProcessStep[];
}

function asTestimonials(json: unknown): PortfolioTestimonial[] {
  if (!Array.isArray(json)) return [];
  return json as PortfolioTestimonial[];
}

function asClients(json: unknown): PortfolioClient[] {
  if (!Array.isArray(json)) return [];
  return json as PortfolioClient[];
}

async function buildViewModel(row: PortfolioWithRelations): Promise<PortfolioViewModel> {
  const f = row.freelancer;
  const clientCount = await getAssignedClientCount(f.userId);

  return {
    freelancerId: f.id,
    userId: f.userId,
    templateKey: row.templateKey,
    status: row.status,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    hero: {
      name: f.user.name,
      avatar: f.user.avatar,
      role: f.experience[0]?.role ?? null,
      headline: row.headline,
      tagline: row.tagline,
      location: f.location,
      availabilityLabel: AVAILABILITY_LABEL[f.availability] ?? "Available",
      isAvailable: f.availability === "AVAILABLE",
    },
    about: { short: f.bio, long: row.aboutLong },
    skills: f.skills,
    services: row.services,
    stats: {
      experienceYears: row.experienceYears,
      projectsCompleted: row.projects.length,
      clients: clientCount > 0 ? clientCount : null,
    },
    process: asProcessSteps(row.processSteps),
    projects: row.projects.map(mapProject),
    testimonials: asTestimonials(row.testimonials),
    clients: asClients(row.clients),
    boards: row.boards.map(mapBoard),
    socials: {
      email: f.user.email,
      phone: f.phone,
      website: row.website,
      linkedinUrl: f.linkedinUrl,
      instagramUrl: f.instagramUrl,
      behanceUrl: f.behanceUrl,
      dribbbleUrl: f.dribbbleUrl,
      githubUrl: f.githubUrl,
    },
  };
}

/** Ensures a freelancer has a portfolio row (created lazily on first visit
 * to the builder) and returns its id. Idempotent — safe to call every time
 * the builder loads. */
export async function ensurePortfolio(freelancerId: string): Promise<string> {
  const existing = await db.freelancerPortfolio.findUnique({ where: { freelancerId }, select: { id: true } });
  if (existing) return existing.id;
  const created = await db.freelancerPortfolio.create({ data: { freelancerId } });
  return created.id;
}

/** Builder-side view model — includes draft content, scoped by the owning
 * freelancer's userId. Used for the live preview and the editor forms. */
export async function getOwnPortfolioViewModel(userId: string): Promise<PortfolioViewModel | null> {
  const freelancer = await db.freelancer.findUnique({ where: { userId }, select: { id: true } });
  if (!freelancer) return null;

  await ensurePortfolio(freelancer.id);
  const raw = await fetchPortfolioRaw(freelancer.id);
  if (!raw) return null;
  return buildViewModel(raw);
}

/** Public/admin read path — only ever returns a PUBLISHED portfolio, so
 * draft content is never exposed outside the owning freelancer's builder. */
export async function getPublishedPortfolioViewModel(freelancerId: string): Promise<PortfolioViewModel | null> {
  const raw = await fetchPortfolioRaw(freelancerId);
  if (!raw || raw.status !== "PUBLISHED") return null;
  return buildViewModel(raw);
}

/** Same as above, but keyed by User.id — the identifier used everywhere
 * else a freelancer is referenced across the app (Project.freelancerUserId,
 * the Admin → Freelancers card, session user.id), unlike the internal
 * Freelancer.id used only for Prisma relations. Public portfolio URLs and
 * the Admin card's "View Profile" link both resolve through this. */
export async function getPublishedPortfolioByUserId(userId: string): Promise<PortfolioViewModel | null> {
  const freelancer = await db.freelancer.findUnique({ where: { userId }, select: { id: true } });
  if (!freelancer) return null;
  return getPublishedPortfolioViewModel(freelancer.id);
}
