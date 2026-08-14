"use client";

import Link from "next/link";
import { MoreHorizontal, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { initials, truncate } from "@/utils/format";
import { cn } from "@/lib/utils";
import type { FreelancerRecord } from "@/types/freelancer";

const MAX_VISIBLE_SKILLS = 4;
const BIO_MAX_LENGTH = 90;

const STATUS_DISPLAY: Record<string, { label: string; dot: string; text: string }> = {
  Available: { label: "AVAILABLE", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  Busy: { label: "BUSY", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  Unavailable: { label: "OFFLINE", dot: "bg-muted-foreground", text: "text-muted-foreground" },
  Deactivated: { label: "INACTIVE", dot: "bg-destructive", text: "text-destructive" },
};

interface FreelancerCardProps {
  freelancer: FreelancerRecord;
  /** Display position in the current (filtered) list — a stable index for
   * the small "01/02/03" reference number, never persisted as data. */
  index: number;
  onView: (freelancer: FreelancerRecord) => void;
  onEdit: (freelancer: FreelancerRecord) => void;
  onAssignTask: (freelancer: FreelancerRecord) => void;
  onDeactivate: (freelancer: FreelancerRecord) => void;
}

/**
 * Compact editorial freelancer profile card — one reusable component every
 * current and future freelancer renders through identically
 * (FreelancerRecord in, card out). Status is shown exactly once (dot + word,
 * doubling as the card's "large metric"); Projects/Clients are the only
 * counts, shown exactly once in the footer. Sections with no real data
 * (no photo, no bio, no location, no skills) are simply omitted.
 */
export function FreelancerCard({ freelancer, index, onView, onEdit, onAssignTask, onDeactivate }: FreelancerCardProps) {
  const isDeactivated = freelancer.status === "Deactivated";
  const statusKey = isDeactivated ? "Deactivated" : freelancer.availability;
  const status = STATUS_DISPLAY[statusKey] ?? STATUS_DISPLAY.Unavailable;
  const visibleSkills = freelancer.skills.slice(0, MAX_VISIBLE_SKILLS);
  const hiddenSkillCount = freelancer.skills.length - visibleSkills.length;
  const seq = String(index + 1).padStart(2, "0");

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[9px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Profile</span>
          <span className="text-[9px] font-medium text-muted-foreground/70 tabular-nums">{seq}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More actions" />}>
            <MoreHorizontal className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(freelancer)}>View Details</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(freelancer)}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAssignTask(freelancer)} disabled={isDeactivated}>
              Assign Task
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDeactivate(freelancer)}>
              {isDeactivated ? "Reactivate" : "Deactivate"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Image + status (the card's one prominent metric) */}
      <div className="px-4 pt-3 flex items-start justify-between gap-3">
        <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted shrink-0 flex items-center justify-center">
          {freelancer.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={freelancer.avatar} alt={freelancer.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-base font-semibold text-muted-foreground">{initials(freelancer.name)}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 pt-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", status.dot)} />
          <span className={cn("text-sm font-bold uppercase tracking-tight leading-none", status.text)}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Name / role / location — each shown exactly once */}
      <div className="px-4 pt-2.5">
        <h3 className="text-base font-semibold text-foreground truncate">{freelancer.name}</h3>
        {freelancer.role && <p className="text-xs text-muted-foreground truncate mt-0.5">{freelancer.role}</p>}
        {freelancer.location && (
          <p className="text-xs text-muted-foreground/80 truncate mt-0.5 inline-flex items-center gap-1">
            {freelancer.location}
            <ArrowUpRight className="h-3 w-3 shrink-0" />
          </p>
        )}
      </div>

      <div className="mx-4 mt-3 border-t border-border" />

      {/* About */}
      {freelancer.bio && (
        <div className="px-4 pt-3 space-y-1">
          <p className="text-[9px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">About</p>
          <p className="text-xs text-foreground leading-relaxed line-clamp-3">{truncate(freelancer.bio, BIO_MAX_LENGTH)}</p>
        </div>
      )}

      {/* Interests */}
      {freelancer.skills.length > 0 && (
        <div className="px-4 pt-3 space-y-1.5">
          <p className="text-[9px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Interests</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {visibleSkills.map((skill) => (
              <span key={skill} className="text-xs text-foreground">
                {skill}
              </span>
            ))}
            {hiddenSkillCount > 0 && <span className="text-xs text-muted-foreground">+{hiddenSkillCount}</span>}
          </div>
        </div>
      )}

      <div className="mx-4 mt-3 border-t border-border" />

      {/* Connect Card — opens the freelancer's published portfolio website */}
      <div className="px-4 pt-3">
        <Link
          href={`/portfolio/${freelancer.id}`}
          target="_blank"
          className="relative block w-full text-left rounded-lg bg-muted/50 p-3.5 overflow-hidden hover:bg-muted transition-colors group"
        >
          <div
            aria-hidden
            className="absolute right-2 top-2 bottom-2 w-14 text-muted-foreground/40"
            style={{
              backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
              backgroundSize: "7px 7px",
            }}
          />
          <div className="relative flex items-center justify-between">
            <p className="text-[9px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Connect Card</p>
            <span className="text-[9px] font-medium text-muted-foreground/70 tabular-nums">{seq}</span>
          </div>
          <p className="relative text-xs text-foreground mt-2 leading-snug max-w-[65%]">View profile and assign work</p>
          <span className="relative inline-flex items-center gap-1 text-xs font-semibold text-primary mt-2.5">
            View Profile
            <ArrowUpRight className="h-3 w-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </span>
        </Link>
      </div>

      {/* Stats — the only place these numbers appear */}
      <div className="mt-3 border-t border-border grid grid-cols-2 divide-x divide-border">
        <div className="px-4 py-3">
          <p className="text-[9px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Projects</p>
          <p className="text-base font-semibold text-foreground tabular-nums mt-0.5">{freelancer.activeProjects}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[9px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Clients</p>
          <p className="text-base font-semibold text-foreground tabular-nums mt-0.5">{freelancer.assignedClients.length}</p>
        </div>
      </div>
    </div>
  );
}
