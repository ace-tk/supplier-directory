import type { PortfolioStatus } from "@/lib/generated/prisma/enums";

export type { PortfolioStatus };

export type TemplateAvailability = "AVAILABLE" | "COMING_SOON";

export interface PortfolioTemplateMeta {
  key: string;
  name: string;
  description: string;
  availability: TemplateAvailability;
}

export interface PortfolioHero {
  name: string;
  avatar: string | null;
  role: string | null;
  headline: string | null;
  tagline: string | null;
  location: string | null;
  availabilityLabel: string;
  isAvailable: boolean;
}

export interface PortfolioStats {
  experienceYears: number | null;
  projectsCompleted: number;
  clients: number | null;
}

export interface PortfolioProjectVM {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  coverImage: string | null;
  galleryImages: string[];
  projectUrl: string | null;
  clientName: string | null;
  year: number | null;
  tools: string[];
  role: string | null;
  featured: boolean;
  position: number;
}

export interface PortfolioProcessStep {
  order: number;
  title: string;
  description: string;
}

export interface PortfolioTestimonial {
  name: string;
  company?: string;
  quote: string;
  avatar?: string;
}

export interface PortfolioClient {
  name: string;
  logo?: string;
  url?: string;
}

export interface PortfolioPinVM {
  id: string;
  title: string | null;
  description: string | null;
  image: string;
  externalUrl: string | null;
  position: number;
}

export interface PortfolioBoardVM {
  id: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  pins: PortfolioPinVM[];
}

export interface PortfolioSocials {
  email: string;
  phone: string | null;
  website: string | null;
  linkedinUrl: string | null;
  instagramUrl: string | null;
  behanceUrl: string | null;
  dribbbleUrl: string | null;
  githubUrl: string | null;
}

/**
 * Template-independent portfolio content. Every Template component (only
 * "editorial01" is implemented today) renders this same shape — adding
 * Template 02+ later means writing a new presentation component against
 * this exact contract, never changing the data.
 */
export interface PortfolioViewModel {
  freelancerId: string;
  /** User.id — the identifier used for public portfolio URLs and the Admin
   * card's link, consistent with how a freelancer is referenced everywhere
   * else in the app. `freelancerId` above is the internal Freelancer row id. */
  userId: string;
  templateKey: string;
  status: PortfolioStatus;
  publishedAt: string | null;
  hero: PortfolioHero;
  about: { short: string | null; long: string | null };
  skills: string[];
  services: string[];
  stats: PortfolioStats;
  process: PortfolioProcessStep[];
  projects: PortfolioProjectVM[];
  testimonials: PortfolioTestimonial[];
  clients: PortfolioClient[];
  boards: PortfolioBoardVM[];
  socials: PortfolioSocials;
}
