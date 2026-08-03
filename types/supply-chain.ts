import type {
  SupplyChainStatus,
  SupplyChainPriority,
  MilestoneStatus,
  BoardColumn,
  ParticipantKind,
  MediaKind,
  ShareRole,
} from "@/lib/generated/prisma/enums";

export type { SupplyChainStatus, SupplyChainPriority, MilestoneStatus, BoardColumn, ParticipantKind, MediaKind, ShareRole };

export const BOARD_COLUMNS: BoardColumn[] = ["PLANNING", "IN_PROGRESS", "REVIEW", "COMPLETED"];
export const MILESTONE_STATUSES: MilestoneStatus[] = ["NOT_STARTED", "IN_PROGRESS", "WAITING", "COMPLETED", "DELAYED"];
export const PRIORITIES: SupplyChainPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export const DEFAULT_MILESTONE_NAMES = [
  "Order Confirmed",
  "Raw Material",
  "Manufacturing",
  "Quality Check",
  "Packaging",
  "Dispatch",
  "Delivered",
];

export interface ParticipantUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "BUYER" | "SUPPLIER";
  avatar: string | null;
  companyName: string | null;
}

export interface MilestoneParticipantEntry {
  id: string;
  kind: ParticipantKind;
  user: ParticipantUser;
}

export interface MilestoneMediaEntry {
  id: string;
  kind: MediaKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  uploadedBy: ParticipantUser;
  createdAt: string;
}

export interface MilestoneAttachmentEntry {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  uploadedBy: ParticipantUser;
  createdAt: string;
}

export interface MilestoneCommentEntry {
  id: string;
  content: string;
  author: ParticipantUser;
  parentCommentId: string | null;
  edited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MilestoneActivityEntry {
  id: string;
  type: string;
  description: string;
  actor: ParticipantUser | null;
  createdAt: string;
}

export interface MilestoneRecord {
  id: string;
  supplyChainId: string;
  name: string;
  description: string | null;
  status: MilestoneStatus;
  boardColumn: BoardColumn;
  priority: SupplyChainPriority;
  dueDate: string;
  progress: number;
  notes: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  assignees: MilestoneParticipantEntry[];
  tags: MilestoneParticipantEntry[];
  mediaCount: number;
  attachmentCount: number;
  commentCount: number;
}

export interface MilestoneDetail extends MilestoneRecord {
  media: MilestoneMediaEntry[];
  attachments: MilestoneAttachmentEntry[];
  comments: MilestoneCommentEntry[];
  activities: MilestoneActivityEntry[];
}

export interface ShareEntry {
  id: string;
  role: ShareRole;
  user: ParticipantUser;
  sharedBy: ParticipantUser;
  createdAt: string;
}

export interface SupplyChainRecord {
  id: string;
  name: string;
  orderName: string;
  orderNumber: string;
  description: string | null;
  priority: SupplyChainPriority;
  status: SupplyChainStatus;
  expectedDelivery: string;
  ownerId: string;
  buyerUserId: string | null;
  buyerName: string;
  supplierUserId: string | null;
  supplierName: string;
  createdAt: string;
  updatedAt: string;
  milestones: MilestoneRecord[];
  shares: ShareEntry[];
}

export interface SupplyChainAnalytics {
  activeCount: number;
  delayedCount: number;
  completedCount: number;
  inProgressCount: number;
  upcomingDeadlines: number;
}
