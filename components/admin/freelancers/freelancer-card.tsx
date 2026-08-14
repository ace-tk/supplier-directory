"use client";

import { MoreHorizontal, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { initials, truncate } from "@/utils/format";
import { cn } from "@/lib/utils";
import type { FreelancerRecord } from "@/types/freelancer";

const MAX_VISIBLE_SKILLS = 6;
const BIO_MAX_LENGTH = 140;

const STATUS_TEXT_CLASS: Record<string, string> = {
  Available: "text-emerald-600 dark:text-emerald-400",
  Busy: "text-amber-600 dark:text-amber-400",
  Unavailable: "text-muted-foreground",
  Deactivated: "text-destructive",
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
 * Premium editorial freelancer profile card — one reusable component every
 * current and future freelancer renders through identically
 * (FreelancerRecord in, card out). Every section is real data:
 * name/role/location/bio/skills/availability/stats all come straight from
 * the Freelancer profile and its projects; any field the freelancer hasn't
 * filled in (no photo, no bio, no location, no logged experience) simply
 * doesn't render that section rather than showing a placeholder.
 */
export function FreelancerCard({ freelancer, index, onView, onEdit, onAssignTask, onDeactivate }: FreelancerCardProps) {
  const isDeactivated = freelancer.status === "Deactivated";
  const statusLabel = isDeactivated ? "Deactivated" : freelancer.availability;
  const visibleSkills = freelancer.skills.slice(0, MAX_VISIBLE_SKILLS);
  const hiddenSkillCount = freelancer.skills.length - visibleSkills.length;
  const metaLine = [freelancer.role, freelancer.location].filter(Boolean).join(" · ");

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Profile</span>
          <span className="text-[10px] font-medium text-muted-foreground/70 tabular-nums">{String(index + 1).padStart(2, "0")}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More actions" />}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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

      {/* Image + prominent status */}
      <div className="px-5 pt-4 flex items-start justify-between gap-4">
        <div className="w-24 h-24 rounded-xl overflow-hidden bg-muted shrink-0 flex items-center justify-center">
          {freelancer.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={freelancer.avatar} alt={freelancer.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-semibold text-muted-foreground">{initials(freelancer.name)}</span>
          )}
        </div>
        <div className="text-right pt-1">
          <p className={cn("text-xl font-bold uppercase tracking-tight leading-none", STATUS_TEXT_CLASS[statusLabel] ?? "text-foreground")}>
            {statusLabel}
          </p>
        </div>
      </div>

      {/* Name / role / location — each shown exactly once */}
      <div className="px-5 pt-3">
        <h3 className="text-xl font-semibold text-foreground truncate">{freelancer.name}</h3>
        {metaLine && <p className="text-sm text-muted-foreground truncate mt-0.5">{metaLine}</p>}
      </div>

      <div className="mx-5 mt-4 border-t border-border" />

      {/* About */}
      {freelancer.bio && (
        <>
          <div className="px-5 pt-4 space-y-1.5">
            <p className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">About</p>
            <p className="text-sm text-foreground leading-relaxed">{truncate(freelancer.bio, BIO_MAX_LENGTH)}</p>
          </div>
          <div className="mx-5 mt-4 border-t border-border" />
        </>
      )}

      {/* Skills */}
      {freelancer.skills.length > 0 && (
        <>
          <div className="px-5 pt-4 space-y-2">
            <p className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {visibleSkills.map((skill) => (
                <Badge key={skill} variant="outline" className="font-normal">
                  {skill}
                </Badge>
              ))}
              {hiddenSkillCount > 0 && (
                <Badge variant="outline" className="font-normal text-muted-foreground">
                  +{hiddenSkillCount}
                </Badge>
              )}
            </div>
          </div>
          <div className="mx-5 mt-4 border-t border-border" />
        </>
      )}

      {/* Work card — the primary action, doubling as the "connect card" block */}
      <div className="px-5 pt-4">
        <button
          type="button"
          onClick={() => onView(freelancer)}
          className="w-full text-left rounded-xl border border-border p-4 hover:border-primary/50 transition-colors group"
        >
          <p className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Work Card</p>
          <p className="text-sm text-foreground mt-1">View profile and assign work</p>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-primary mt-2">
            View Profile <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </button>
      </div>

      {/* Stats — the only place these numbers appear */}
      <div className="mt-4 border-t border-border grid grid-cols-3 divide-x divide-border">
        <div className="px-5 py-3.5">
          <p className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Projects</p>
          <p className="text-lg font-semibold text-foreground tabular-nums mt-0.5">{freelancer.activeProjects}</p>
        </div>
        <div className="px-5 py-3.5">
          <p className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Clients</p>
          <p className="text-lg font-semibold text-foreground tabular-nums mt-0.5">{freelancer.assignedClients.length}</p>
        </div>
        <div className="px-5 py-3.5">
          <p className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Performance</p>
          <p className="text-lg font-semibold text-foreground tabular-nums mt-0.5">{freelancer.performanceScore}%</p>
        </div>
      </div>
    </div>
  );
}
