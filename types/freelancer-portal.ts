import type {
  FreelancerAvailability,
  FreelancerStatus,
  PaymentStatus,
  ProposalStatus,
  ProposalChannel,
  ProjectStatus,
  ProjectPriority,
  TaskStatus,
  TaskPriority,
} from "@/lib/generated/prisma/enums";

export type {
  FreelancerAvailability,
  FreelancerStatus,
  PaymentStatus,
  ProposalStatus,
  ProposalChannel,
  ProjectStatus,
  ProjectPriority,
  TaskStatus,
  TaskPriority,
};

export interface FreelancerPortfolioItem {
  id: string;
  caption: string | null;
  dataUrl: string;
  order: number;
  createdAt: string;
}

export interface FreelancerExperienceEntry {
  id: string;
  role: string;
  company: string;
  startDate: string;
  endDate: string | null;
  description: string | null;
  order: number;
}

export interface FreelancerProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatar: string | null;
  location: string | null;
  phone: string | null;
  bio: string | null;
  skills: string[];
  linkedinUrl: string | null;
  instagramUrl: string | null;
  behanceUrl: string | null;
  dribbbleUrl: string | null;
  githubUrl: string | null;
  resumeFileName: string | null;
  resumeDataUrl: string | null;
  availability: FreelancerAvailability;
  status: FreelancerStatus;
  paymentStatus: PaymentStatus;
  performanceScore: number;
  createdAt: string;
  portfolioItems: FreelancerPortfolioItem[];
  experience: FreelancerExperienceEntry[];
}

export interface ProjectRecord {
  id: string;
  name: string;
  clientName: string;
  startDate: string;
  expectedEndDate: string;
  priority: ProjectPriority;
  description: string | null;
  status: ProjectStatus;
  freelancerUserId: string;
  freelancerName: string;
  createdAt: string;
  updatedAt: string;
  taskCount: number;
}

export interface FreelancerTaskRecord {
  id: string;
  title: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  projectId: string | null;
  projectName: string | null;
  freelancerUserId: string;
  createdAt: string;
}

export interface ProposalRecord {
  id: string;
  title: string;
  clientName: string;
  description: string | null;
  channel: ProposalChannel;
  status: ProposalStatus;
  freelancerUserId: string;
  freelancerName: string;
  createdByName: string;
  createdAt: string;
}

export interface FreelancerDashboardStats {
  activeProjects: number;
  pendingProposals: number;
  assignedTasks: number;
  completedProjects: number;
  unreadNotifications: number;
}
