"use client";

import { useState } from "react";
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { MilestoneCard } from "./MilestoneCard";
import { updateMilestoneColumnAction } from "@/services/supply-chain";
import { BOARD_COLUMNS } from "@/types/supply-chain";
import { cn } from "@/lib/utils";
import type { Milestone, BoardColumn } from "@/types/supply-chain";

const COLUMN_ACCENT: Record<BoardColumn, string> = {
  Planning: "bg-slate-500",
  "In Progress": "bg-primary",
  Review: "bg-amber-500",
  Completed: "bg-emerald-500",
};

function SortableBoardCard({ milestone, onClick }: { milestone: Milestone; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: milestone.id,
    data: { column: milestone.boardColumn },
  });

  return (
    <MilestoneCard
      milestone={milestone}
      onClick={onClick}
      variant="board"
      cardRef={setNodeRef}
      isDragging={isDragging}
      dragHandleProps={{ ...attributes, ...listeners }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    />
  );
}

function Column({
  column,
  milestones,
  onMilestoneClick,
}: {
  column: BoardColumn;
  milestones: Milestone[];
  onMilestoneClick: (m: Milestone) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column });

  return (
    <div className="flex-1 min-w-[260px]">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={cn("w-2 h-2 rounded-full", COLUMN_ACCENT[column])} />
        <p className="text-sm font-semibold text-foreground">{column}</p>
        <span className="text-xs text-muted-foreground">{milestones.length}</span>
      </div>
      <SortableContext items={milestones.map((m) => m.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "flex flex-col gap-3 min-h-[120px] rounded-2xl border border-dashed p-2.5 transition-colors duration-150",
            isOver ? "border-primary/50 bg-primary/5" : "border-border/60"
          )}
        >
          {milestones.map((m) => (
            <SortableBoardCard key={m.id} milestone={m} onClick={() => onMilestoneClick(m)} />
          ))}
          {milestones.length === 0 && (
            <p className="text-center text-[11px] text-muted-foreground/60 py-6">Drop here</p>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

interface KanbanBoardProps {
  chainId: string;
  milestones: Milestone[];
  onMilestonesChange: (milestones: Milestone[]) => void;
  onMilestoneClick: (milestone: Milestone) => void;
}

export function KanbanBoard({ chainId, milestones, onMilestonesChange, onMilestoneClick }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeMilestone = milestones.find((m) => m.id === active.id);
    if (!activeMilestone) return;

    const overColumn = (BOARD_COLUMNS as string[]).includes(String(over.id))
      ? (over.id as BoardColumn)
      : milestones.find((m) => m.id === over.id)?.boardColumn;

    if (!overColumn || overColumn === activeMilestone.boardColumn) return;

    const updated = milestones.map((m) => (m.id === activeMilestone.id ? { ...m, boardColumn: overColumn } : m));
    onMilestonesChange(updated);

    const result = await updateMilestoneColumnAction(chainId, activeMilestone.id, overColumn);
    if (!result.success) toast.error(result.error);
  }

  const activeMilestone = milestones.find((m) => m.id === activeId) ?? null;

  return (
    <DndContext
      id={`board-${chainId}`}
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-2">
        {BOARD_COLUMNS.map((column) => (
          <Column
            key={column}
            column={column}
            milestones={milestones.filter((m) => m.boardColumn === column)}
            onMilestoneClick={onMilestoneClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeMilestone && (
          <motion.div className="rotate-1 scale-105">
            <MilestoneCard milestone={activeMilestone} variant="board" />
          </motion.div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
