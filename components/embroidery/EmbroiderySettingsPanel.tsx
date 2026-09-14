"use client";

import { Loader2, Plus, RotateCcw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingSlider } from "@/components/garment-studio/ToolControls";
import { cn } from "@/lib/utils";
import { EMBROIDERY_STYLES, type EmbroiderySettings } from "@/lib/embroidery-production";

function LabeledToggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex items-center justify-between w-full py-1">
      <span className="text-sm text-foreground">{label}</span>
      <span className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors", on ? "bg-primary" : "bg-muted-foreground/30")}>
        <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", on ? "translate-x-[18px]" : "translate-x-0.5")} />
      </span>
    </button>
  );
}

export function EmbroiderySettingsPanel({
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
  const activeStyle = EMBROIDERY_STYLES.find((s) => s.id === settings.style);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Embroidery Settings</p>
        <button type="button" onClick={onReset} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Style</p>
        <Select value={settings.style} onValueChange={(v) => v && onChange({ ...settings, style: v as EmbroiderySettings["style"] })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EMBROIDERY_STYLES.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activeStyle && <p className="mt-1 text-[11px] text-muted-foreground">Rendered via AI as a {activeStyle.technique} look — not a distinct stitch algorithm.</p>}
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Thread Colors</p>
        <div className="flex flex-wrap items-center gap-2">
          {settings.threadColors.map((color, i) => (
            <div key={i} className="relative group">
              <input
                type="color"
                value={color}
                onChange={(e) => {
                  const next = [...settings.threadColors];
                  next[i] = e.target.value;
                  onChange({ ...settings, threadColors: next });
                }}
                className="w-7 h-7 rounded-full border border-border cursor-pointer"
                aria-label={`Thread color ${i + 1}`}
              />
              <button
                type="button"
                onClick={() => onChange({ ...settings, threadColors: settings.threadColors.filter((_, idx) => idx !== i) })}
                aria-label="Remove color"
                className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-3.5 h-3.5 rounded-full bg-card border border-border text-muted-foreground"
              >
                <X className="w-2 h-2" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ ...settings, threadColors: [...settings.threadColors, "#111827"] })}
            aria-label="Add thread color"
            className="flex items-center justify-center w-7 h-7 rounded-full border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <SettingSlider label="Detail Level" value={settings.detailLevel} unit="%" min={0} max={100} onChange={(v) => onChange({ ...settings, detailLevel: v })} />

      <LabeledToggle label="Outline" on={settings.outline} onChange={(v) => onChange({ ...settings, outline: v })} />
      <LabeledToggle label="Fill" on={settings.fill} onChange={(v) => onChange({ ...settings, fill: v })} />

      <Button className="w-full" onClick={onRegenerate} disabled={regenerating}>
        {regenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {regenerating ? "Regenerating…" : "Regenerate"}
      </Button>
    </div>
  );
}
