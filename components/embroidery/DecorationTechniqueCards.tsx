"use client";

import type { ComponentType } from "react";
import { Box, Focus, Layers, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";
import { DECORATION_TECHNIQUES, type DecorationTechnique } from "@/lib/embroidery-production";

const TECHNIQUE_ICONS: Record<DecorationTechnique, ComponentType<{ className?: string }>> = {
  EMBROIDERY: Scissors,
  SCREEN_PRINT: Layers,
  HD_PRINT: Focus,
  PUFF_PRINT: Box,
};

/** Picks the decoration/production technique for this design — same
 * card-picker pattern as EmbroideryStyleCards. Every technique reuses the
 * same settings/state; only the AI guidance and production labels differ
 * (see DECORATION_TECHNIQUES). Selecting a card never calls AI by itself —
 * it only updates settings, same as every other control in this panel. */
export function DecorationTechniqueCards({ value, onChange }: { value: DecorationTechnique; onChange: (id: DecorationTechnique) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {Object.values(DECORATION_TECHNIQUES).map((technique) => {
        const Icon = TECHNIQUE_ICONS[technique.id];
        const selected = value === technique.id;
        return (
          <button
            key={technique.id}
            type="button"
            onClick={() => onChange(technique.id)}
            aria-pressed={selected}
            className={cn(
              "flex flex-col items-start gap-1.5 rounded-lg border p-2.5 text-left transition-colors",
              selected ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30"
            )}
          >
            <Icon className={cn("w-4 h-4", selected ? "text-primary" : "text-muted-foreground")} />
            <span className={cn("text-xs font-semibold", selected ? "text-primary" : "text-foreground")}>{technique.label}</span>
            <span className="text-[10px] text-muted-foreground leading-snug">{technique.description}</span>
          </button>
        );
      })}
    </div>
  );
}
