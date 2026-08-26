"use client";

import { Download, Minus, Plus, RotateCcw, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MIN_REPEAT = 2;
const MAX_REPEAT = 8;

export function RepeatResult({
  referenceImages,
  tileImage,
  repeatCount,
  onRepeatCountChange,
  name,
  onNameChange,
  onSave,
  saving,
  saved,
  onStartOver,
}: {
  referenceImages: string[];
  tileImage: string;
  repeatCount: number;
  onRepeatCountChange: (n: number) => void;
  name: string;
  onNameChange: (name: string) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  onStartOver: () => void;
}) {
  function download() {
    const link = document.createElement("a");
    link.href = tileImage;
    link.download = `${(name || "repeat-print").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-1x1-tile.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function clamp(n: number) {
    return Math.min(MAX_REPEAT, Math.max(MIN_REPEAT, n));
  }

  const tileSizePercent = 100 / repeatCount;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Untitled Print"
          className="max-w-xs font-semibold text-base border-transparent bg-transparent px-0 hover:bg-muted focus-visible:bg-muted focus-visible:px-2 transition-colors"
        />
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onStartOver}>
            <RotateCcw className="w-3.5 h-3.5" /> Start over
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? "Saved" : saving ? "Saving…" : "Save design"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[140px_1fr_1fr] gap-6 p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Reference</p>
          <div className="flex lg:flex-col gap-2">
            {referenceImages.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt={`Reference ${i + 1}`} className="w-16 h-16 lg:w-full lg:h-auto lg:aspect-square rounded-lg object-cover border border-border" />
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Seamless Tile (1:1)</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={tileImage} alt="Generated seamless tile" className="w-full aspect-square rounded-xl object-cover border border-border bg-muted" />
          <button
            type="button"
            onClick={download}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-primary transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Download 1:1 tile
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Repeat Preview</p>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {repeatCount} × {repeatCount}
            </span>
          </div>
          <div
            className="w-full aspect-square rounded-xl border border-border"
            style={{
              backgroundImage: `url(${tileImage})`,
              backgroundRepeat: "repeat",
              backgroundSize: `${tileSizePercent}% ${tileSizePercent}%`,
            }}
          />
          <div className="flex items-center gap-3 mt-3">
            <button
              type="button"
              onClick={() => onRepeatCountChange(clamp(repeatCount + 1))}
              aria-label="Increase repeat"
              className="flex items-center justify-center w-7 h-7 rounded-full border border-border text-foreground hover:bg-muted shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <input
              type="range"
              min={MIN_REPEAT}
              max={MAX_REPEAT}
              step={1}
              value={repeatCount}
              onChange={(e) => onRepeatCountChange(clamp(Number(e.target.value)))}
              className="flex-1 accent-primary"
              aria-label="Repeat scale"
            />
            <button
              type="button"
              onClick={() => onRepeatCountChange(clamp(repeatCount - 1))}
              aria-label="Decrease repeat"
              className="flex items-center justify-center w-7 h-7 rounded-full border border-border text-foreground hover:bg-muted shrink-0"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-medium text-muted-foreground shrink-0 tabular-nums w-16 text-right">{repeatCount}× repeat</span>
          </div>
        </div>
      </div>

      <p className="px-6 pb-5 text-[11px] text-muted-foreground text-center">
        AI-generated. The tile is intended to be edge-seamless — always review before using it in production artwork.
      </p>
    </div>
  );
}
