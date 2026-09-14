"use client";

import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingSlider } from "@/components/garment-studio/ToolControls";
import type { EmbroiderySettings } from "@/lib/embroidery-production";

function LabeledToggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex items-center justify-between w-full py-1">
      <span className="text-sm text-foreground">{label}</span>
      <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${on ? "bg-primary" : "bg-muted-foreground/30"}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}

/** Detail/outline/fill are AI generation instructions (see
 * services/embroidery.ts buildConversionPrompt), applied only when
 * Regenerate re-runs the conversion from the untouched source artwork —
 * never a live/instant preview, since the current pipeline has no
 * cheaper-than-a-full-generation preview path. */
export function RefinePanel({
  settings,
  onChange,
  onRegenerate,
  onReset,
  regenerating,
}: {
  settings: EmbroiderySettings;
  onChange: (settings: EmbroiderySettings) => void;
  onRegenerate: () => void;
  onReset: () => void;
  regenerating: boolean;
}) {
  return (
    <div className="space-y-3">
      <SettingSlider label="Detail Level (Simplify)" value={settings.detailLevel} unit="%" min={0} max={100} onChange={(v) => onChange({ ...settings, detailLevel: v })} />
      <LabeledToggle label="Outline" on={settings.outline} onChange={(v) => onChange({ ...settings, outline: v })} />
      <LabeledToggle label="Fill" on={settings.fill} onChange={(v) => onChange({ ...settings, fill: v })} />

      <p className="text-[11px] text-muted-foreground">
        AI embroidery preview settings — they guide regeneration, not a machine digitization engine. Estimated stitch density and thread count are in Production below.
      </p>

      <div className="flex items-center gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onReset}>
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </Button>
        <Button size="sm" className="flex-1" onClick={onRegenerate} disabled={regenerating}>
          {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {regenerating ? "Regenerating…" : "Regenerate Preview"}
        </Button>
      </div>
    </div>
  );
}
