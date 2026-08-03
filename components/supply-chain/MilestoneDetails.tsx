"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateMilestoneAction } from "@/services/supply-chain";
import { MILESTONE_STATUS_LABELS, PRIORITY_LABELS } from "@/lib/supply-chain-ui";
import { MILESTONE_STATUSES, PRIORITIES } from "@/types/supply-chain";
import type { MilestoneDetail, MilestoneStatus, SupplyChainPriority } from "@/types/supply-chain";

interface MilestoneDetailsProps {
  milestone: MilestoneDetail;
  canEdit: boolean;
  onChange: (patch: Partial<MilestoneDetail>) => void;
}

export function MilestoneDetails({ milestone, canEdit, onChange }: MilestoneDetailsProps) {
  const [name, setName] = useState(milestone.name);
  const [description, setDescription] = useState(milestone.description ?? "");
  const [notes, setNotes] = useState(milestone.notes ?? "");
  const [progress, setProgress] = useState(milestone.progress);

  async function save(patch: Record<string, unknown>, localPatch: Partial<MilestoneDetail>) {
    onChange(localPatch);
    const result = await updateMilestoneAction(milestone.id, patch);
    if (!result.success) toast.error(result.error);
  }

  return (
    <div className="space-y-3.5">
      <div className="space-y-1.5">
        <Label htmlFor="ms-title" className="text-xs">Title</Label>
        <Input
          id="ms-title"
          value={name}
          disabled={!canEdit}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== milestone.name && save({ name }, { name })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ms-description" className="text-xs">Description</Label>
        <Textarea
          id="ms-description"
          rows={2}
          value={description}
          disabled={!canEdit}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== (milestone.description ?? "") && save({ description }, { description })}
          placeholder="What does this milestone cover?"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
          <Select
            value={milestone.status}
            onValueChange={(v) => v && canEdit && save({ status: v as MilestoneStatus }, { status: v as MilestoneStatus })}
          >
            <SelectTrigger className="w-full" disabled={!canEdit}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MILESTONE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {MILESTONE_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Priority</Label>
          <Select
            value={milestone.priority}
            onValueChange={(v) => v && canEdit && save({ priority: v as SupplyChainPriority }, { priority: v as SupplyChainPriority })}
          >
            <SelectTrigger className="w-full" disabled={!canEdit}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ms-due" className="text-xs">Due Date</Label>
          <Input
            id="ms-due"
            type="date"
            disabled={!canEdit}
            defaultValue={milestone.dueDate.slice(0, 10)}
            onBlur={(e) => {
              if (!e.target.value) return;
              const iso = new Date(e.target.value).toISOString();
              save({ dueDate: iso }, { dueDate: iso });
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ms-progress" className="text-xs">Completion ({progress}%)</Label>
          <input
            id="ms-progress"
            type="range"
            min={0}
            max={100}
            step={5}
            value={progress}
            disabled={!canEdit}
            onChange={(e) => setProgress(Number(e.target.value))}
            onMouseUp={() => progress !== milestone.progress && save({ progress }, { progress })}
            onTouchEnd={() => progress !== milestone.progress && save({ progress }, { progress })}
            className="w-full accent-primary h-8"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ms-notes" className="text-xs">Internal Notes</Label>
        <Textarea
          id="ms-notes"
          rows={3}
          value={notes}
          disabled={!canEdit}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (milestone.notes ?? "") && save({ notes }, { notes })}
          placeholder="Private notes for your team..."
        />
      </div>
    </div>
  );
}
