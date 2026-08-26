"use client";

import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type GenerationStage = "extracting" | "generating" | "tiling";

const STAGES: { key: GenerationStage; label: string; caption: string }[] = [
  { key: "extracting", label: "Extracting", caption: "Reading the motif, colours, and art style from your reference." },
  { key: "generating", label: "Generating", caption: "Generating a new seamless print from that description." },
  { key: "tiling", label: "Tiling", caption: "Building the repeat preview." },
];

export function GenerationProgress({ stage, elapsedSeconds, referenceImage }: { stage: GenerationStage; elapsedSeconds: number; referenceImage?: string }) {
  const activeIndex = STAGES.findIndex((s) => s.key === stage);

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16">
      <div className="flex items-center gap-3">
        {STAGES.map((s, i) => (
          <div key={s.key} className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-full border text-[10px] font-semibold",
                  i < activeIndex
                    ? "bg-foreground border-foreground text-background"
                    : i === activeIndex
                      ? "border-foreground text-foreground"
                      : "border-border text-muted-foreground"
                )}
              >
                {i < activeIndex ? <Check className="w-3 h-3" /> : i === activeIndex ? <Loader2 className="w-3 h-3 animate-spin" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider",
                  i <= activeIndex ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STAGES.length - 1 && <div className={cn("w-10 h-px", i < activeIndex ? "bg-foreground" : "bg-border")} />}
          </div>
        ))}
      </div>

      {referenceImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={referenceImage} alt="Reference" className="w-24 h-24 rounded-xl object-cover border border-border shadow-sm rotate-2" />
      )}

      <p className="text-sm text-muted-foreground text-center max-w-xs">{STAGES[activeIndex]?.caption}</p>
      <p className="text-[11px] text-muted-foreground/70 tabular-nums">{elapsedSeconds}s elapsed</p>
    </div>
  );
}
