export type PaymentStatus = "Paid" | "Pending" | "Overdue";
export type Availability = "Available" | "Busy" | "Unavailable";
export type FreelancerStatus = "Active" | "Deactivated";

export interface FreelancerRecord {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  location: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  instagramUrl: string | null;
  // Most recent FreelancerExperience entry's role/title, if the freelancer
  // has logged any — real data, never a fabricated "profession". null when
  // no experience entry exists.
  role: string | null;
  bio: string | null;
  skills: string[];
  assignedClients: string[];
  assignedSuppliers: string[];
  activeProjects: number;
  paymentStatus: PaymentStatus;
  performanceScore: number;
  availability: Availability;
  status: FreelancerStatus;
  // Up to 3 real cover images from the freelancer's *published*
  // FreelancerPortfolio — empty when they have none published yet. Never
  // fake/placeholder artwork.
  portfolioPreviewImages: string[];
}
