"use client";

import { StickyNote, Image as ImageIcon, Video, Paperclip, Activity } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/portal/status-badge";
import { AvatarGroup, Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatShortDate, initialsFor } from "@/lib/supply-chain-ui";
import { cn } from "@/lib/utils";
import type { Milestone } from "@/types/supply-chain";

const PLACEHOLDER_TABS = [
  { value: "notes", label: "Notes", icon: StickyNote, copy: "Buyers and suppliers will be able to leave threaded notes on this milestone." },
  { value: "images", label: "Images", icon: ImageIcon, copy: "Reference and inspection images will appear here." },
  { value: "videos", label: "Videos", icon: Video, copy: "Production and quality-check videos will appear here." },
  { value: "attachments", label: "Files", icon: Paperclip, copy: "Shared documents and attachments will appear here." },
  { value: "activity", label: "Activity", icon: Activity, copy: "A full activity log for this milestone will appear here." },
];

interface MilestoneDrawerProps {
  milestone: Milestone | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MilestoneDrawer({ milestone, open, onOpenChange }: MilestoneDrawerProps) {
  if (!milestone) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full flex flex-col">
        <SheetHeader className="pb-0">
          <SheetTitle className="text-lg">{milestone.name}</SheetTitle>
          <div className="flex items-center gap-2 pt-1">
            <StatusBadge status={milestone.status} />
            <span className="text-xs text-muted-foreground">Due {formatShortDate(milestone.dueDate)}</span>
          </div>
        </SheetHeader>

        <div className="px-4 space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium text-foreground">{milestone.progress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full", milestone.status === "Completed" ? "bg-emerald-500" : "bg-primary")}
                style={{ width: `${milestone.progress}%` }}
              />
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Assigned</p>
            {milestone.assignees.length > 0 ? (
              <div className="flex items-center gap-2">
                <AvatarGroup>
                  {milestone.assignees.map((a) => (
                    <Avatar key={a.id} size="sm">
                      <AvatarFallback className={cn("text-white text-[9px] font-semibold", a.colorClass)}>
                        {initialsFor(a.name)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </AvatarGroup>
                <span className="text-xs text-muted-foreground">
                  {milestone.assignees.map((a) => a.name).join(", ")}
                </span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/60">Unassigned</p>
            )}
          </div>
        </div>

        <Tabs defaultValue="notes" className="flex-1 flex flex-col min-h-0 px-4 pb-4">
          <TabsList className="w-full">
            {PLACEHOLDER_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex-1">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {PLACEHOLDER_TABS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="flex-1 mt-3">
              <div className="flex flex-col items-center justify-center text-center h-full py-10 rounded-xl border border-dashed border-border">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted mb-3">
                  <tab.icon className="h-4.5 w-4.5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground max-w-[220px]">{tab.copy}</p>
                <span className="mt-2 text-[10px] text-muted-foreground/60 uppercase tracking-wide">Coming soon</span>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
