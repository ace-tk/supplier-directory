"use client";

import { motion } from "framer-motion";
import { GripVertical, CheckCircle2 } from "lucide-react";
import { StatusBadge } from "@/components/portal/status-badge";
import { AvatarGroup, Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MILESTONE_CARD_STYLES, MILESTONE_STATUS_LABELS, formatShortDate, initialsFor, avatarColorFor } from "@/lib/supply-chain-ui";
import { cn } from "@/lib/utils";
import type { MilestoneRecord } from "@/types/supply-chain";

interface MilestoneCardProps {
  milestone: MilestoneRecord;
  onClick?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  isDragging?: boolean;
  variant?: "timeline" | "board";
  style?: React.CSSProperties;
  cardRef?: React.Ref<HTMLDivElement>;
  dimmed?: boolean;
}

export function MilestoneCard({
  milestone,
  onClick,
  dragHandleProps,
  isDragging,
  variant = "timeline",
  style,
  cardRef,
  dimmed,
}: MilestoneCardProps) {
  const styles = MILESTONE_CARD_STYLES[milestone.status];
  const isCompleted = milestone.status === "COMPLETED";

  return (
    <motion.div
      ref={cardRef}
      style={style}
      layout
      whileHover={{ y: -3 }}
      className={cn(
        "group relative shrink-0 rounded-2xl border bg-card p-4 shadow-card hover:shadow-elevated transition-shadow duration-200 cursor-pointer",
        variant === "timeline" ? "w-[228px]" : "w-full",
        styles.ring,
        styles.glow,
        isDragging && "opacity-50",
        dimmed && "opacity-30 saturate-50"
      )}
      onClick={onClick}
    >
      {isCompleted && (
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-2xl pointer-events-none ring-1 ring-emerald-500/30"
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {isCompleted && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
              <CheckCircle2 className={cn("h-3.5 w-3.5 shrink-0", styles.text)} />
            </motion.span>
          )}
          <h4 className="text-sm font-semibold text-foreground truncate">{milestone.name}</h4>
        </div>
        {dragHandleProps && (
          <button
            type="button"
            {...dragHandleProps}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 p-0.5 rounded text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity cursor-grab active:cursor-grabbing"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <StatusBadge status={MILESTONE_STATUS_LABELS[milestone.status]} />
        <span className="text-[11px] text-muted-foreground">{formatShortDate(milestone.dueDate)}</span>
      </div>

      <div className="mb-3">
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${milestone.progress}%` }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            className={cn("h-full rounded-full", isCompleted ? "bg-emerald-500" : "bg-primary")}
          />
        </div>
      </div>

      {milestone.assignees.length > 0 ? (
        <AvatarGroup>
          {milestone.assignees.map((a) => (
            <Avatar key={a.id} size="sm">
              <AvatarFallback className={cn("text-white text-[9px] font-semibold", avatarColorFor(a.user.id))}>
                {initialsFor(a.user.name)}
              </AvatarFallback>
            </Avatar>
          ))}
        </AvatarGroup>
      ) : (
        <p className="text-[11px] text-muted-foreground/60">Unassigned</p>
      )}
    </motion.div>
  );
}
