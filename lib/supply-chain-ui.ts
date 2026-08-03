import type { SupplyChainPriority, MilestoneStatus } from "@/types/supply-chain";

export const PRIORITY_STYLES: Record<SupplyChainPriority, string> = {
  Low: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  Medium: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  High: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Urgent: "bg-red-500/10 text-red-600 dark:text-red-400",
};

export const PRIORITY_DOT: Record<SupplyChainPriority, string> = {
  Low: "bg-slate-400",
  Medium: "bg-blue-500",
  High: "bg-amber-500",
  Urgent: "bg-red-500",
};

export const MILESTONE_CARD_STYLES: Record<MilestoneStatus, { ring: string; glow: string; text: string }> = {
  Completed: {
    ring: "border-emerald-500/40",
    glow: "shadow-[0_0_20px_-4px_rgba(16,185,129,0.35)]",
    text: "text-emerald-500",
  },
  "In Progress": {
    ring: "border-primary/50",
    glow: "shadow-[0_0_24px_-4px_rgba(99,102,241,0.4)]",
    text: "text-primary",
  },
  Delayed: {
    ring: "border-red-500/40",
    glow: "shadow-[0_0_20px_-4px_rgba(239,68,68,0.35)]",
    text: "text-red-500",
  },
  Upcoming: {
    ring: "border-border",
    glow: "",
    text: "text-muted-foreground",
  },
};

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function initialsFor(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
