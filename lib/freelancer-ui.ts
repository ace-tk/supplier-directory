import type {
  ProjectStatus,
  ProjectPriority,
  TaskStatus,
  TaskPriority,
  ProposalStatus,
  ProposalChannel,
  FreelancerAvailability,
  FreelancerStatus,
  PaymentStatus,
} from "@/types/freelancer-portal";

export { formatShortDate, formatDateTime, avatarColorFor, initialsFor, formatFileSize } from "@/lib/supply-chain-ui";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  UPCOMING: "Upcoming",
  ACTIVE: "Active",
  COMPLETED: "Completed",
};

export const PROJECT_PRIORITY_LABELS: Record<ProjectPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  OVERDUE: "Overdue",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  SENT: "Sent",
  VIEWED: "Viewed",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
};

export const PROPOSAL_CHANNEL_LABELS: Record<ProposalChannel, string> = {
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
  BOTH: "Email + WhatsApp",
};

export const AVAILABILITY_LABELS: Record<FreelancerAvailability, string> = {
  AVAILABLE: "Available",
  BUSY: "Busy",
  UNAVAILABLE: "Unavailable",
};

export const FREELANCER_STATUS_LABELS: Record<FreelancerStatus, string> = {
  ACTIVE: "Active",
  DEACTIVATED: "Deactivated",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PAID: "Paid",
  PENDING: "Pending",
  OVERDUE: "Overdue",
};

export const PRIORITY_DOT: Record<ProjectPriority, string> = {
  LOW: "bg-slate-400",
  MEDIUM: "bg-blue-500",
  HIGH: "bg-amber-500",
  URGENT: "bg-red-500",
};
