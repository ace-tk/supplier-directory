"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/portal/status-badge";
import { MilestoneDetails } from "./MilestoneDetails";
import { TimelineAssignments } from "./TimelineAssignments";
import { TimelineMedia } from "./TimelineMedia";
import { TimelineAttachments } from "./TimelineAttachments";
import { TimelineComments } from "./TimelineComments";
import { TimelineActivity } from "./TimelineActivity";
import { MILESTONE_STATUS_LABELS, formatShortDate } from "@/lib/supply-chain-ui";
import { getMilestoneDetailAction, getMilestoneActivityAction } from "@/services/supply-chain";
import { useSession } from "@/hooks/use-session";
import type { MilestoneDetail } from "@/types/supply-chain";

interface MilestoneDrawerProps {
  milestoneId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMilestoneUpdated?: (milestone: MilestoneDetail) => void;
}

export function MilestoneDrawer({ milestoneId, open, onOpenChange, onMilestoneUpdated }: MilestoneDrawerProps) {
  const currentUser = useSession();
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [milestone, setMilestone] = useState<MilestoneDetail | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canComment, setCanComment] = useState(false);
  const [canManageAssignees, setCanManageAssignees] = useState(false);

  const loading = open && !!milestoneId && loadedId !== milestoneId;

  useEffect(() => {
    if (!open || !milestoneId) return;
    getMilestoneDetailAction(milestoneId).then((result) => {
      if (!result.success) {
        toast.error(result.error);
        onOpenChange(false);
        return;
      }
      setMilestone(result.data.milestone);
      setCanEdit(result.data.canEdit);
      setCanComment(result.data.canComment);
      setCanManageAssignees(result.data.canManageAssignees);
      setLoadedId(milestoneId);
    });
  }, [open, milestoneId, onOpenChange]);

  function updateLocal(patch: Partial<MilestoneDetail>) {
    if (!milestone) return;
    const next = { ...milestone, ...patch };
    setMilestone(next);
    onMilestoneUpdated?.(next);
  }

  function handleTabChange(value: string | null) {
    // Refresh the activity feed each time it's opened, rather than trying
    // to track every mutation elsewhere in the drawer that logs one.
    if (value !== "activity" || !milestone) return;
    getMilestoneActivityAction(milestone.id).then((result) => {
      if (result.success) updateLocal({ activities: result.data });
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full flex flex-col">
        {loading || !milestone ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <SheetHeader className="pb-0">
              <SheetTitle className="text-lg">{milestone.name}</SheetTitle>
              <div className="flex items-center gap-2 pt-1">
                <StatusBadge status={MILESTONE_STATUS_LABELS[milestone.status]} />
                <span className="text-xs text-muted-foreground">Due {formatShortDate(milestone.dueDate)}</span>
              </div>
            </SheetHeader>

            <Tabs defaultValue="details" onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0 px-4 pb-4">
              <TabsList className="w-full">
                <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                <TabsTrigger value="media" className="flex-1">
                  Media {milestone.mediaCount > 0 && `(${milestone.mediaCount})`}
                </TabsTrigger>
                <TabsTrigger value="files" className="flex-1">
                  Files {milestone.attachmentCount > 0 && `(${milestone.attachmentCount})`}
                </TabsTrigger>
                <TabsTrigger value="comments" className="flex-1">
                  Comments {milestone.commentCount > 0 && `(${milestone.commentCount})`}
                </TabsTrigger>
                <TabsTrigger value="activity" className="flex-1">Activity</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto scrollbar-thin mt-3">
                <TabsContent value="details" className="space-y-5">
                  <MilestoneDetails milestone={milestone} canEdit={canEdit} onChange={updateLocal} />
                  <div className="pt-4 border-t border-border/60">
                    <TimelineAssignments
                      milestoneId={milestone.id}
                      assignees={milestone.assignees}
                      tags={milestone.tags}
                      canManageAssignees={canManageAssignees}
                      canManageTags={canComment}
                      onAssigneesChange={(assignees) => updateLocal({ assignees })}
                      onTagsChange={(tags) => updateLocal({ tags })}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="media">
                  <TimelineMedia
                    milestoneId={milestone.id}
                    media={milestone.media}
                    canEdit={canEdit}
                    onMediaChange={(media) => updateLocal({ media, mediaCount: media.length })}
                  />
                </TabsContent>

                <TabsContent value="files">
                  <TimelineAttachments
                    milestoneId={milestone.id}
                    attachments={milestone.attachments}
                    canEdit={canEdit}
                    onAttachmentsChange={(attachments) => updateLocal({ attachments, attachmentCount: attachments.length })}
                  />
                </TabsContent>

                <TabsContent value="comments">
                  <TimelineComments
                    milestoneId={milestone.id}
                    comments={milestone.comments}
                    canComment={canComment}
                    currentUser={currentUser}
                    onCommentsChange={(comments) => updateLocal({ comments, commentCount: comments.length })}
                  />
                </TabsContent>

                <TabsContent value="activity">
                  <TimelineActivity activities={milestone.activities} />
                </TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
