"use client";

import type { ComponentType } from "react";
import { Box, CircleDot, Minus, PaintBucket, Waves } from "lucide-react";
import { cn } from "@/lib/utils";
import { EMBROIDERY_STYLES, type EmbroideryStyleId } from "@/lib/embroidery-production";

const STYLE_ICONS: Record<EmbroideryStyleId, ComponentType<{ className?: string }>> = {
  standard: CircleDot,
  satin: Waves,
  fill: PaintBucket,
  running: Minus,
  "3d-puff": Box,
};

const STYLE_DESCRIPTIONS: Record<EmbroideryStyleId, string> = {
  standard: "Balanced embroidery treatment",
  satin: "Smooth filled areas and borders",
  fill: "Dense filled embroidery areas",
  running: "Fine lines and outlines",
  "3d-puff": "Raised embroidery effect",
};

/** Visual style picker replacing a plain dropdown — each option is an AI
 * generation instruction (see services/embroidery.ts buildConversionPrompt),
 * not a distinct digitization algorithm, which the caller labels via the
 * "AI embroidery preview" note underneath. */
export function EmbroideryStyleCards({ value, onChange }: { value: EmbroideryStyleId; onChange: (id: EmbroideryStyleId) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {EMBROIDERY_STYLES.map((style) => {
        const Icon = STYLE_ICONS[style.id];
        const selected = value === style.id;
        return (
          <button
            key={style.id}
            type="button"
            onClick={() => onChange(style.id)}
            className={cn(
              "flex flex-col items-start gap-1.5 rounded-lg border p-2.5 text-left transition-colors",
              selected ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30"
            )}
          >
            <Icon className={cn("w-4 h-4", selected ? "text-primary" : "text-muted-foreground")} />
            <span className={cn("text-xs font-semibold", selected ? "text-primary" : "text-foreground")}>{style.label}</span>
            <span className="text-[10px] text-muted-foreground leading-snug">{STYLE_DESCRIPTIONS[style.id]}</span>
          </button>
        );
      })}
    </div>
  );
}
