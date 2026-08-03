import type { SupplyChainPriority, MilestoneStatus, SupplyChainStatus, BoardColumn } from "@/types/supply-chain";

export const PRIORITY_STYLES: Record<SupplyChainPriority, string> = {
  LOW: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  MEDIUM: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  HIGH: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  URGENT: "bg-red-500/10 text-red-600 dark:text-red-400",
};

export const PRIORITY_DOT: Record<SupplyChainPriority, string> = {
  LOW: "bg-slate-400",
  MEDIUM: "bg-blue-500",
  HIGH: "bg-amber-500",
  URGENT: "bg-red-500",
};

export const PRIORITY_LABELS: Record<SupplyChainPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  WAITING: "Waiting",
  COMPLETED: "Completed",
  DELAYED: "Delayed",
};

export const SUPPLY_CHAIN_STATUS_LABELS: Record<SupplyChainStatus, string> = {
  ACTIVE: "Active",
  DELAYED: "Delayed",
  COMPLETED: "Completed",
  IN_PROGRESS: "In Progress",
};

export const BOARD_COLUMN_LABELS: Record<BoardColumn, string> = {
  PLANNING: "Planning",
  IN_PROGRESS: "In Progress",
  REVIEW: "Review",
  COMPLETED: "Completed",
};

export const MILESTONE_CARD_STYLES: Record<MilestoneStatus, { ring: string; glow: string; text: string }> = {
  COMPLETED: {
    ring: "border-emerald-500/40",
    glow: "shadow-[0_0_20px_-4px_rgba(16,185,129,0.35)]",
    text: "text-emerald-500",
  },
  IN_PROGRESS: {
    ring: "border-primary/50",
    glow: "shadow-[0_0_24px_-4px_rgba(99,102,241,0.4)]",
    text: "text-primary",
  },
  WAITING: {
    ring: "border-amber-500/40",
    glow: "shadow-[0_0_16px_-4px_rgba(245,158,11,0.3)]",
    text: "text-amber-500",
  },
  DELAYED: {
    ring: "border-red-500/40",
    glow: "shadow-[0_0_20px_-4px_rgba(239,68,68,0.35)]",
    text: "text-red-500",
  },
  NOT_STARTED: {
    ring: "border-border",
    glow: "",
    text: "text-muted-foreground",
  },
};

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const AVATAR_COLORS = ["bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500", "bg-fuchsia-500"];

export function avatarColorFor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash << 5) - hash + userId.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function initialsFor(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function supplyChainPath(role: string, chainId: string): string {
  if (role === "BUYER") return `/buyer/supply-chain/${chainId}`;
  if (role === "SUPPLIER") return `/supplier/supply-chain/${chainId}`;
  return `/supply-chain/${chainId}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
