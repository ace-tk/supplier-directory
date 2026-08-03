"use client";

import { Activity, Flag, CalendarClock, ImagePlus, RefreshCw, StickyNote, MessageSquare, UserPlus, Tag, Paperclip } from "lucide-react";
import { formatDateTime } from "@/lib/supply-chain-ui";
import type { MilestoneActivityEntry } from "@/types/supply-chain";

const ICONS: Record<string, typeof Activity> = {
  "Milestone Created": Flag,
  Updated: RefreshCw,
  "Due Date Updated": CalendarClock,
  "Images Uploaded": ImagePlus,
  "Videos Uploaded": ImagePlus,
  "Media Removed": ImagePlus,
  "Attachment Added": Paperclip,
  "Attachment Removed": Paperclip,
  "Status Changed": RefreshCw,
  "Notes Added": StickyNote,
  "Comment Added": MessageSquare,
  Assignment: UserPlus,
  Tagged: Tag,
  "Board Updated": RefreshCw,
};

export function TimelineActivity({ activities }: { activities: MilestoneActivityEntry[] }) {
  if (activities.length === 0) {
    return <p className="text-center text-[11px] text-muted-foreground/60 py-6">No activity yet.</p>;
  }

  return (
    <div className="space-y-0.5">
      {activities.map((entry, i) => {
        const Icon = ICONS[entry.type] ?? Activity;
        return (
          <div key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < activities.length - 1 && <div className="absolute left-[13px] top-6 bottom-0 w-px bg-border" />}
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted shrink-0 z-10">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-xs text-foreground">{entry.description}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {entry.actor?.name ?? "System"} · {formatDateTime(entry.createdAt)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
