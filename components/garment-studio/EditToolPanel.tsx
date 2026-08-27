"use client";

import type { ReactNode } from "react";
import { PlayCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// The shared panel layout confirmed by the reference screenshots (the
// Patterns tool), reused for every edit tool per instruction — same
// numbered-step shell, same Save placement/style, same "How editing tools
// work" link. Only the step content differs per tool.

export interface StepConfig {
  title: string;
  description?: string;
  content?: ReactNode;
}

export function EditToolPanel({
  toolTitle,
  maskInstruction,
  extraSteps = [],
  saveLabel = "Save",
  onSave,
  saving,
  saveDisabled,
}: {
  toolTitle: string;
  maskInstruction: string;
  extraSteps?: StepConfig[];
  saveLabel?: string;
  onSave: () => void;
  saving: boolean;
  saveDisabled?: boolean;
}) {
  const steps: StepConfig[] = [{ title: "Mask area", description: maskInstruction }, ...extraSteps];
  const saveStepNumber = steps.length + 1;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-5 space-y-5">
        <h2 className="text-base font-bold text-foreground">{toolTitle}</h2>

        {steps.map((step, i) => (
          <div key={i}>
            <p className="text-sm font-semibold text-foreground mb-1">
              {i + 1}. {step.title}
            </p>
            {step.description && <p className="text-sm text-muted-foreground mb-2">{step.description}</p>}
            {step.content}
          </div>
        ))}

        <div>
          <p className="text-sm font-semibold text-foreground mb-1">{saveStepNumber}. Save</p>
          <p className="text-sm text-muted-foreground mb-2">Hit Save button to apply changes.</p>
          <a href="#" onClick={(e) => e.preventDefault()} className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
            <PlayCircle className="w-3.5 h-3.5" /> How editing tools work
          </a>
        </div>
      </div>

      <div className="px-5 py-4 border-t border-border shrink-0">
        <Button className="w-full" onClick={onSave} disabled={saving || saveDisabled}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {saving ? "Saving…" : saveLabel}
        </Button>
      </div>
    </div>
  );
}
