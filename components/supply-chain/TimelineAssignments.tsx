"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlus, Tag as TagIcon, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusBadge } from "@/components/portal/status-badge";
import { initialsFor, avatarColorFor } from "@/lib/supply-chain-ui";
import { getTeamOptions, type DirectoryOption } from "@/services/supply-chain";
import { getShareableUsersAction, type ShareableUser } from "@/services/supply-chain-sharing";
import {
  assignUserToMilestoneAction,
  unassignUserFromMilestoneAction,
  tagUserOnMilestoneAction,
  untagUserFromMilestoneAction,
} from "@/services/milestone-participants";
import { cn } from "@/lib/utils";
import type { MilestoneParticipantEntry, ParticipantUser } from "@/types/supply-chain";

function ProfileChip({ participant }: { participant: MilestoneParticipantEntry }) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        closeDelay={150}
        render={<button type="button" className="shrink-0" />}
      >
        <Avatar size="sm">
          <AvatarFallback className={cn("text-white text-[9px] font-semibold", avatarColorFor(participant.user.id))}>
            {initialsFor(participant.user.name)}
          </AvatarFallback>
        </Avatar>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-3 space-y-1.5">
        <p className="text-sm font-semibold text-foreground">{participant.user.name}</p>
        <p className="text-xs text-muted-foreground">{participant.user.email}</p>
        {participant.user.companyName && <p className="text-xs text-muted-foreground">{participant.user.companyName}</p>}
        <StatusBadge status={participant.user.role} />
      </PopoverContent>
    </Popover>
  );
}

interface TimelineAssignmentsProps {
  milestoneId: string;
  assignees: MilestoneParticipantEntry[];
  tags: MilestoneParticipantEntry[];
  canManageAssignees: boolean;
  canManageTags: boolean;
  onAssigneesChange: (assignees: MilestoneParticipantEntry[]) => void;
  onTagsChange: (tags: MilestoneParticipantEntry[]) => void;
}

export function TimelineAssignments({
  milestoneId,
  assignees,
  tags,
  canManageAssignees,
  canManageTags,
  onAssigneesChange,
  onTagsChange,
}: TimelineAssignmentsProps) {
  const [teamOptions, setTeamOptions] = useState<DirectoryOption[]>([]);
  const [shareableUsers, setShareableUsers] = useState<ShareableUser[]>([]);
  const [assignPickerOpen, setAssignPickerOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);

  useEffect(() => {
    getTeamOptions().then(setTeamOptions);
    getShareableUsersAction().then(setShareableUsers);
  }, []);

  function toParticipantEntry(user: { id: string; name: string; email?: string; role?: string; companyName?: string }): MilestoneParticipantEntry {
    return {
      id: `${milestoneId}-${user.id}`,
      kind: "ASSIGNEE",
      user: {
        id: user.id,
        name: user.name,
        email: user.email ?? "",
        role: (user.role as ParticipantUser["role"]) ?? "ADMIN",
        avatar: null,
        companyName: user.companyName ?? null,
      },
    };
  }

  async function handleAssign(option: DirectoryOption) {
    const result = await assignUserToMilestoneAction(milestoneId, option.id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    onAssigneesChange([...assignees, toParticipantEntry(option)]);
    setAssignPickerOpen(false);
    toast.success(`${option.name} assigned`);
  }

  async function handleUnassign(userId: string) {
    const result = await unassignUserFromMilestoneAction(milestoneId, userId);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    onAssigneesChange(assignees.filter((a) => a.user.id !== userId));
  }

  async function handleTag(user: ShareableUser) {
    const result = await tagUserOnMilestoneAction(milestoneId, user.id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    onTagsChange([...tags, toParticipantEntry(user)]);
    setTagPickerOpen(false);
  }

  async function handleUntag(userId: string) {
    const result = await untagUserFromMilestoneAction(milestoneId, userId);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    onTagsChange(tags.filter((t) => t.user.id !== userId));
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground">Assigned Team Members</p>
          {canManageAssignees && (
            <Popover open={assignPickerOpen} onOpenChange={setAssignPickerOpen}>
              <PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Assign team member" />}>
                <UserPlus className="h-3.5 w-3.5" />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-1.5">
                {teamOptions
                  .filter((o) => !assignees.some((a) => a.user.id === o.id))
                  .map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => handleAssign(o)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs hover:bg-muted transition-colors"
                    >
                      <Avatar size="sm">
                        <AvatarFallback className={cn("text-white text-[9px] font-semibold", avatarColorFor(o.id))}>
                          {initialsFor(o.name)}
                        </AvatarFallback>
                      </Avatar>
                      {o.name}
                    </button>
                  ))}
                {teamOptions.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">No team members yet.</p>}
              </PopoverContent>
            </Popover>
          )}
        </div>
        {assignees.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {assignees.map((a) => (
              <div key={a.id} className="flex items-center gap-1.5 rounded-full bg-muted/60 pl-1 pr-2 py-1">
                <ProfileChip participant={a} />
                <span className="text-xs text-foreground">{a.user.name}</span>
                {canManageAssignees && (
                  <button type="button" onClick={() => handleUnassign(a.user.id)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground/60">No one assigned yet.</p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground">Tagged</p>
          {canManageTags && (
            <Popover open={tagPickerOpen} onOpenChange={setTagPickerOpen}>
              <PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Tag someone" />}>
                <TagIcon className="h-3.5 w-3.5" />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-1.5 max-h-60 overflow-y-auto">
                {shareableUsers
                  .filter((u) => !tags.some((t) => t.user.id === u.id))
                  .map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleTag(u)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs hover:bg-muted transition-colors"
                    >
                      <Avatar size="sm">
                        <AvatarFallback className={cn("text-white text-[9px] font-semibold", avatarColorFor(u.id))}>
                          {initialsFor(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate">{u.name}</span>
                      <span className="text-[10px] text-muted-foreground">{u.role}</span>
                    </button>
                  ))}
              </PopoverContent>
            </Popover>
          )}
        </div>
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <div key={t.id} className="flex items-center gap-1.5 rounded-full bg-muted/60 pl-1 pr-2 py-1">
                <ProfileChip participant={t} />
                <span className="text-xs text-foreground">{t.user.name}</span>
                {canManageTags && (
                  <button type="button" onClick={() => handleUntag(t.user.id)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground/60">No one tagged yet.</p>
        )}
      </div>
    </div>
  );
}
