"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MilestoneCard } from "./MilestoneCard";
import { TimelineConnector } from "./TimelineConnector";
import { reorderMilestonesAction, addMilestoneAction } from "@/services/supply-chain";
import { toast } from "sonner";
import type { MilestoneRecord } from "@/types/supply-chain";

function SortableMilestoneCard({ milestone, onClick, dimmed }: { milestone: MilestoneRecord; onClick: () => void; dimmed?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: milestone.id });

  return (
    <MilestoneCard
      milestone={milestone}
      onClick={onClick}
      cardRef={setNodeRef}
      isDragging={isDragging}
      dimmed={dimmed}
      dragHandleProps={{ ...attributes, ...listeners }}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    />
  );
}

function AddMilestoneButton({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  function submit() {
    if (!name.trim()) return;
    onAdd(name.trim());
    setName("");
    setOpen(false);
  }

  if (open) {
    return (
      <div className="shrink-0 flex items-center gap-1.5 bg-card border border-primary/40 rounded-full pl-3 pr-1 py-1 shadow-elevated">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Milestone name..."
          className="h-7 w-36 border-0 bg-transparent px-0 focus-visible:ring-0"
        />
        <Button size="icon-sm" className="rounded-full shrink-0" onClick={submit} aria-label="Add milestone">
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          className="rounded-full shrink-0"
          onClick={() => setOpen(false)}
          aria-label="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={() => setOpen(true)}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors"
      aria-label="Add step"
      title="Add step"
    >
      <Plus className="h-3.5 w-3.5" />
    </motion.button>
  );
}

interface TimelineCanvasProps {
  chainId: string;
  milestones: MilestoneRecord[];
  canEdit: boolean;
  visibleIds?: Set<string>;
  onMilestonesChange: (milestones: MilestoneRecord[]) => void;
  onMilestoneClick: (milestone: MilestoneRecord) => void;
}

export function TimelineCanvas({ chainId, milestones, canEdit, visibleIds, onMilestonesChange, onMilestoneClick }: TimelineCanvasProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const sorted = [...milestones].sort((a, b) => a.order - b.order);

  function handleDragStart(event: DragStartEvent) {
    if (!canEdit) return;
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!canEdit) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sorted.findIndex((m) => m.id === active.id);
    const newIndex = sorted.findIndex((m) => m.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sorted, oldIndex, newIndex).map((m, i) => ({ ...m, order: i }));
    onMilestonesChange(reordered);

    const result = await reorderMilestonesAction(chainId, reordered.map((m) => m.id));
    if (!result.success) toast.error(result.error);
  }

  async function handleAdd(name: string, position: { afterMilestoneId?: string; beforeMilestoneId?: string }) {
    const now = new Date().toISOString();
    const result = await addMilestoneAction(chainId, { name, ...position });
    if (!result.success) {
      toast.error(result.error);
      return;
    }

    const placeholder: MilestoneRecord = {
      id: result.data.id,
      supplyChainId: chainId,
      name,
      description: null,
      status: "NOT_STARTED",
      boardColumn: "PLANNING",
      priority: "MEDIUM",
      dueDate: now,
      progress: 0,
      notes: null,
      order: 0,
      createdAt: now,
      updatedAt: now,
      assignees: [],
      tags: [],
      mediaCount: 0,
      attachmentCount: 0,
      commentCount: 0,
    };

    const insertAt = position.beforeMilestoneId
      ? sorted.findIndex((m) => m.id === position.beforeMilestoneId)
      : position.afterMilestoneId
        ? sorted.findIndex((m) => m.id === position.afterMilestoneId) + 1
        : sorted.length;

    const next = [...sorted];
    next.splice(insertAt === -1 ? sorted.length : insertAt, 0, placeholder);
    onMilestonesChange(next.map((m, i) => ({ ...m, order: i })));
    toast.success(`"${name}" added to the timeline`);
  }

  const activeMilestone = sorted.find((m) => m.id === activeId) ?? null;

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-8 overflow-x-auto">
      <DndContext
        sensors={sensors}
        id={`timeline-${chainId}`}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sorted.map((m) => m.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex items-center min-w-max px-2 py-2">
            {canEdit && <AddMilestoneButton onAdd={(name) => handleAdd(name, { beforeMilestoneId: sorted[0]?.id })} />}

            {sorted.map((milestone, i) => (
              <div key={milestone.id} className="flex items-center">
                {i > 0 && <TimelineConnector leftStatus={sorted[i - 1].status} />}
                <div className="mx-2">
                  <SortableMilestoneCard
                    milestone={milestone}
                    onClick={() => onMilestoneClick(milestone)}
                    dimmed={visibleIds ? !visibleIds.has(milestone.id) : false}
                  />
                </div>
                <div className="flex items-center">
                  {i < sorted.length - 1 && <TimelineConnector leftStatus={milestone.status} />}
                  {canEdit && (
                    <div className="mx-2">
                      <AddMilestoneButton onAdd={(name) => handleAdd(name, { afterMilestoneId: milestone.id })} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          <AnimatePresence>
            {activeMilestone && (
              <div className="rotate-2 scale-105">
                <MilestoneCard milestone={activeMilestone} />
              </div>
            )}
          </AnimatePresence>
        </DragOverlay>
      </DndContext>
    </div>
  );
}
