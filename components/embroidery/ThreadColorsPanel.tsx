"use client";

import { Plus, X } from "lucide-react";
import { THREAD_COLOR_PALETTE, nearestThreadColorName } from "@/lib/embroidery-production";

export function ThreadColorsPanel({ colors, onChange }: { colors: string[]; onChange: (colors: string[]) => void }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {colors.map((hex, i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-1.5">
            <input
              type="color"
              value={hex}
              onChange={(e) => {
                const next = [...colors];
                next[i] = e.target.value;
                onChange(next);
              }}
              className="w-6 h-6 rounded-full border border-border cursor-pointer shrink-0"
              aria-label={`Thread ${i + 1} color`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground truncate">
                Thread {String(i + 1).padStart(2, "0")} — {nearestThreadColorName(hex)}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tabular-nums">{hex}</p>
            </div>
            <button type="button" onClick={() => onChange(colors.filter((_, idx) => idx !== i))} aria-label="Remove thread color" className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {colors.length === 0 && <p className="text-xs text-muted-foreground">No thread colors yet — add one below.</p>}
      </div>

      <button
        type="button"
        onClick={() => onChange([...colors, "#111111"])}
        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <Plus className="w-3.5 h-3.5" /> Add Thread
      </button>

      <div>
        <p className="text-[10px] text-muted-foreground mb-1.5">Curated palette</p>
        <div className="grid grid-cols-8 gap-1.5">
          {THREAD_COLOR_PALETTE.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.name}
              onClick={() => onChange([...colors, c.hex])}
              className="aspect-square rounded-full border border-border hover:scale-110 transition-transform"
              style={{ backgroundColor: c.hex }}
              aria-label={`Add ${c.name}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
