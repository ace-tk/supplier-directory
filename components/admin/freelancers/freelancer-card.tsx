"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  MoreHorizontal,
  ArrowUpRight,
  Send,
  Briefcase,
  MessageCircle,
  Share2,
  Mail,
  Link2,
  Camera,
  ImageOff,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { LinkedInIcon } from "@/components/icons/linkedin-icon";
import { initials, truncate } from "@/utils/format";
import { cn } from "@/lib/utils";
import type { FreelancerRecord } from "@/types/freelancer";

const MAX_VISIBLE_SKILLS = 4;
const BIO_MAX_LENGTH = 160;
const THUMBS_PER_PAGE = 3;

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
 * (FreelancerRecord in, card out). Every section (About/Skills/Portfolio)
 * always renders in the same structural position on every card; when the
 * underlying field has no real data, an honest "not added yet" placeholder
 * fills the slot instead of fake content or a hidden section — this keeps
 * every card visually consistent without ever inventing data.
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
  const [portfolioPage, setPortfolioPage] = useState(0);

  const isDeactivated = freelancer.status === "Deactivated";
  const statusKey = isDeactivated ? "Deactivated" : freelancer.availability;
  const status = STATUS_DISPLAY[statusKey] ?? STATUS_DISPLAY.Unavailable;
  const visibleSkills = freelancer.skills.slice(0, MAX_VISIBLE_SKILLS);
  const hiddenSkillCount = freelancer.skills.length - visibleSkills.length;
  const seq = String(index + 1).padStart(2, "0");
  const portfolioHref = `/portfolio/${freelancer.id}`;

  const totalPortfolioImages = freelancer.portfolioPreviewImages.length;
  const pageStart = portfolioPage * THUMBS_PER_PAGE;
  const visibleThumbs = freelancer.portfolioPreviewImages.slice(pageStart, pageStart + THUMBS_PER_PAGE);
  const hasPrevPage = portfolioPage > 0;
  const hasNextPage = pageStart + THUMBS_PER_PAGE < totalPortfolioImages;

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

  function handleDownloadPortfolio() {
    if (totalPortfolioImages === 0) return;
    const slug = freelancer.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    freelancer.portfolioPreviewImages.forEach((src, i) => {
      const a = document.createElement("a");
      a.href = src;
      a.download = `${slug}-portfolio-${i + 1}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
    toast.success(`Downloading ${totalPortfolioImages} portfolio image${totalPortfolioImages > 1 ? "s" : ""}`);
  }

  return (
    <div className="relative isolate rounded-xl border border-border bg-card overflow-hidden flex flex-col text-sm">
      {/* Decorative display-order watermark — never persisted as profile identity. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-7 z-0 select-none font-mono text-6xl font-bold leading-none tracking-[-0.08em] text-foreground/[0.035] sm:text-7xl dark:text-foreground/[0.045]"
      >
        {seq}
      </span>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-3.5">
        <span className="text-[9px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Profile</span>
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

      {/* Hero: photo beside About — matches the reference layout */}
      <div className="relative z-10 px-4 pt-3 flex gap-3">
        <div className="w-24 h-24 rounded-xl overflow-hidden bg-muted shrink-0 flex items-center justify-center">
          {freelancer.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={freelancer.avatar} alt={freelancer.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl font-semibold text-muted-foreground">{initials(freelancer.name)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">About</p>
          <p className="mt-1 text-xs text-foreground leading-relaxed line-clamp-4">
            {freelancer.bio ? (
              truncate(freelancer.bio, BIO_MAX_LENGTH)
            ) : (
              <span className="text-muted-foreground italic">No bio added yet.</span>
            )}
          </p>
        </div>
      </div>

      {/* Name + role */}
      <div className="relative z-10 px-4 pt-3">
        <h3 className="truncate font-mono text-base font-bold uppercase tracking-[0.06em] text-foreground">{freelancer.name}</h3>
        {freelancer.role && <p className="text-xs text-muted-foreground truncate mt-0.5">{freelancer.role}</p>}
      </div>

      {/* Skills */}
      <div className="relative z-10 px-4 pt-3 space-y-1.5">
        <p className="text-[9px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Skills</p>
        {freelancer.skills.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {visibleSkills.map((skill) => (
              <span key={skill} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground">
                {skill}
              </span>
            ))}
            {hiddenSkillCount > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">+{hiddenSkillCount}</span>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No skills listed yet.</p>
        )}
      </div>

      <div className="relative z-10 mx-4 mt-3 border-t border-border" />

      {/* Portfolio preview — real cover images from the freelancer's published portfolio */}
      <div className="relative z-10 px-4 pt-3">
        <div className="flex items-center justify-between">
          <Link href={portfolioHref} target="_blank" className="flex items-center gap-1 group">
            <p className="text-[9px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Portfolio</p>
            <ArrowUpRight className="h-3 w-3 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </Link>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={handleDownloadPortfolio}
                  disabled={totalPortfolioImages === 0}
                  aria-label="Download portfolio images"
                  className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-muted-foreground"
                />
              }
            >
              <Download className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent>{totalPortfolioImages > 0 ? "Download portfolio images" : "No portfolio images yet"}</TooltipContent>
          </Tooltip>
        </div>

        {totalPortfolioImages > 0 ? (
          <div className="mt-2 flex items-center gap-1.5">
            {totalPortfolioImages > THUMBS_PER_PAGE && (
              <button
                type="button"
                onClick={() => setPortfolioPage((p) => p - 1)}
                disabled={!hasPrevPage}
                aria-label="Previous portfolio images"
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            )}
            <div className="grid grid-cols-3 gap-1.5 flex-1">
              {visibleThumbs.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={pageStart + i} src={src} alt="" className="w-full aspect-square rounded-lg object-cover bg-muted" />
              ))}
            </div>
            {totalPortfolioImages > THUMBS_PER_PAGE && (
              <button
                type="button"
                onClick={() => setPortfolioPage((p) => p + 1)}
                disabled={!hasNextPage}
                aria-label="Next portfolio images"
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-3 text-muted-foreground">
            <ImageOff className="h-3.5 w-3.5 shrink-0" />
            <span className="text-xs">No portfolio projects yet</span>
          </div>
        )}
      </div>

      {/* Stats — real values only */}
      <div className="relative z-10 mt-3 border-t border-border grid grid-cols-4 divide-x divide-border">
        <div className="px-2.5 py-3 min-w-0">
          <p className="text-[9px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Projects</p>
          <p className="text-base font-semibold text-foreground tabular-nums mt-0.5">{freelancer.activeProjects}</p>
        </div>
        <div className="px-2.5 py-3 min-w-0">
          <p className="text-[9px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Clients</p>
          <p className="text-base font-semibold text-foreground tabular-nums mt-0.5">{freelancer.assignedClients.length}</p>
        </div>
        <div className="px-2.5 py-3 min-w-0">
          <p className="text-[9px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Performance</p>
          <p className="text-base font-semibold text-foreground tabular-nums mt-0.5">{freelancer.performanceScore}%</p>
        </div>
        <div className="px-2.5 py-3 min-w-0">
          <p className="text-[9px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">Location</p>
          <p className="text-sm font-semibold text-foreground truncate mt-0.5" title={freelancer.location ?? undefined}>
            {freelancer.location ?? "—"}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="relative z-10 mt-auto border-t border-border p-3 grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" disabled={isDeactivated} onClick={() => onSendProposal(freelancer)}>
          <Send className="h-3.5 w-3.5" /> Send Proposal
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={isDeactivated} onClick={() => onAssignWork(freelancer)}>
          <Briefcase className="h-3.5 w-3.5" /> Assign Work
        </Button>
      </div>
      <div className="relative z-10 px-3 pb-3 flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="flex-1 gap-1.5" aria-label="Share freelancer profile" />}>
            <Share2 className="h-3.5 w-3.5" /> Share
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={handleEmail}>
              <Mail className="h-3.5 w-3.5" /> Email
            </DropdownMenuItem>
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

        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5"
          aria-label={`Send message to ${freelancer.name}`}
          disabled={isDeactivated}
          onClick={() => onDiscuss(freelancer)}
        >
          <Send className="h-3.5 w-3.5" /> Send Message
        </Button>

        {freelancer.phone && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="WhatsApp" disabled={isDeactivated} onClick={handleWhatsApp} />
              }
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent>Message on WhatsApp</TooltipContent>
          </Tooltip>
        )}

      </div>
    </div>
  );
}
