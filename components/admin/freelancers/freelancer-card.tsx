"use client";

import Link from "next/link";
import { toast } from "sonner";
import { MoreHorizontal, ArrowUpRight, Send, Briefcase, MessageSquare, Share2, Mail, MessageCircle, Link2, Camera, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { LinkedInIcon } from "@/components/icons/linkedin-icon";
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
  onSendProposal: (freelancer: FreelancerRecord) => void;
  onAssignWork: (freelancer: FreelancerRecord) => void;
  onDiscuss: (freelancer: FreelancerRecord) => void;
}

/**
 * Compact editorial freelancer profile card — one reusable component every
 * current and future freelancer renders through identically
 * (FreelancerRecord in, card out). Sections with no real data (no photo, no
 * bio, no location, no skills, no published portfolio) are simply omitted
 * or shown with a truthful empty state — never fake placeholder content.
 */
export function FreelancerCard({
  freelancer,
  index,
  onView,
  onEdit,
  onAssignTask,
  onDeactivate,
  onSendProposal,
  onAssignWork,
  onDiscuss,
}: FreelancerCardProps) {
  const isDeactivated = freelancer.status === "Deactivated";
  const statusKey = isDeactivated ? "Deactivated" : freelancer.availability;
  const status = STATUS_DISPLAY[statusKey] ?? STATUS_DISPLAY.Unavailable;
  const visibleSkills = freelancer.skills.slice(0, MAX_VISIBLE_SKILLS);
  const hiddenSkillCount = freelancer.skills.length - visibleSkills.length;
  const seq = String(index + 1).padStart(2, "0");
  const portfolioHref = `/portfolio/${freelancer.id}`;

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${portfolioHref}`);
      toast.success("Portfolio link copied");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  function handleWhatsApp() {
    if (!freelancer.phone) return;
    const digits = freelancer.phone.replace(/[^\d]/g, "");
    window.open(`https://wa.me/${digits}`, "_blank", "noopener,noreferrer");
  }

  function handleEmail() {
    window.location.href = `mailto:${freelancer.email}`;
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[9px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Profile</span>
          <span className="text-[9px] font-medium text-muted-foreground/70 tabular-nums">{seq}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", status.dot)} />
            <span className={cn("text-[10px] font-bold uppercase tracking-tight leading-none", status.text)}>
              {status.label}
            </span>
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
      </div>

      {/* Photo + name/role/location */}
      <div className="px-4 pt-3 flex items-start gap-3">
        <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted shrink-0 flex items-center justify-center">
          {freelancer.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={freelancer.avatar} alt={freelancer.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl font-semibold text-muted-foreground">{initials(freelancer.name)}</span>
          )}
        </div>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-base font-semibold text-foreground truncate">{freelancer.name}</h3>
          {freelancer.role && <p className="text-xs text-muted-foreground truncate mt-0.5">{freelancer.role}</p>}
          {freelancer.location && <p className="text-xs text-muted-foreground/80 truncate mt-0.5">{freelancer.location}</p>}
        </div>
      </div>

      <div className="mx-4 mt-3 border-t border-border" />

      {/* About */}
      {freelancer.bio && (
        <div className="px-4 pt-3 space-y-1">
          <p className="text-[9px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">About</p>
          <p className="text-xs text-foreground leading-relaxed line-clamp-3">{truncate(freelancer.bio, BIO_MAX_LENGTH)}</p>
        </div>
      )}

      {/* Skills */}
      {freelancer.skills.length > 0 && (
        <div className="px-4 pt-3 space-y-1.5">
          <p className="text-[9px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Skills</p>
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

      {/* Portfolio preview — real cover images from the freelancer's published portfolio */}
      <Link href={portfolioHref} target="_blank" className="px-4 pt-3 block group">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Portfolio</p>
          <ArrowUpRight className="h-3 w-3 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
        </div>
        {freelancer.portfolioPreviewImages.length > 0 ? (
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            {freelancer.portfolioPreviewImages.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt="" className="w-full aspect-square rounded-lg object-cover bg-muted" />
            ))}
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-3 text-muted-foreground">
            <ImageOff className="h-3.5 w-3.5 shrink-0" />
            <span className="text-xs">No portfolio projects yet</span>
          </div>
        )}
      </Link>

      {/* Stats — real values only */}
      <div className="mt-3 border-t border-border grid grid-cols-3 divide-x divide-border">
        <div className="px-3 py-3">
          <p className="text-[9px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Projects</p>
          <p className="text-base font-semibold text-foreground tabular-nums mt-0.5">{freelancer.activeProjects}</p>
        </div>
        <div className="px-3 py-3">
          <p className="text-[9px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Clients</p>
          <p className="text-base font-semibold text-foreground tabular-nums mt-0.5">{freelancer.assignedClients.length}</p>
        </div>
        <div className="px-3 py-3">
          <p className="text-[9px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Performance</p>
          <p className="text-base font-semibold text-foreground tabular-nums mt-0.5">{freelancer.performanceScore}%</p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-auto border-t border-border p-3 grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" disabled={isDeactivated} onClick={() => onSendProposal(freelancer)}>
          <Send className="h-3.5 w-3.5" /> Send Proposal
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={isDeactivated} onClick={() => onAssignWork(freelancer)}>
          <Briefcase className="h-3.5 w-3.5" /> Assign Work
        </Button>
      </div>
      <div className="px-3 pb-3 flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Discuss" disabled={isDeactivated} onClick={() => onDiscuss(freelancer)} />
            }
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent>Send a message</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Share" />}>
            <Share2 className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={handleEmail}>
              <Mail className="h-3.5 w-3.5" /> Email
            </DropdownMenuItem>
            {freelancer.phone && (
              <DropdownMenuItem onClick={handleWhatsApp}>
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </DropdownMenuItem>
            )}
            {freelancer.linkedinUrl && (
              <DropdownMenuItem render={<a href={freelancer.linkedinUrl} target="_blank" rel="noopener noreferrer" />}>
                <LinkedInIcon className="h-3.5 w-3.5" /> View LinkedIn
              </DropdownMenuItem>
            )}
            {freelancer.instagramUrl && (
              <DropdownMenuItem render={<a href={freelancer.instagramUrl} target="_blank" rel="noopener noreferrer" />}>
                <Camera className="h-3.5 w-3.5" /> View Instagram
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleCopyLink}>
              <Link2 className="h-3.5 w-3.5" /> Copy Portfolio Link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
