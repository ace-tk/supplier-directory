"use client";

import { Plus, X } from "lucide-react";
import { THREAD_COLOR_PALETTE, MAX_THREAD_COLORS, nearestThreadColorName, type ThreadColor } from "@/lib/embroidery-production";
import { PantoneShadePicker } from "@/components/embroidery/PantoneShadePicker";
import type { PantoneColor } from "@/lib/pantone/types";

export function ThreadColorsPanel({ colors, onChange }: { colors: ThreadColor[]; onChange: (colors: ThreadColor[]) => void }) {
  const atMax = colors.length >= MAX_THREAD_COLORS;

  function addHex(hex: string) {
    if (atMax) return;
    onChange([...colors, { hex }]);
  }

  function updateHex(i: number, hex: string) {
    // Editing the swatch detaches it from any Pantone reference — it's no
    // longer that shade's digital approximation once the user repicks it.
    const next = [...colors];
    next[i] = { hex };
    onChange(next);
  }

  function removeAt(i: number) {
    onChange(colors.filter((_, idx) => idx !== i));
  }

  function addPantone(color: PantoneColor) {
    if (atMax || colors.some((c) => c.pantoneCode === color.code)) return;
    onChange([...colors, { hex: color.hex, pantoneCode: color.code, pantoneName: color.name, pantoneSystem: color.system, pantoneSuffix: color.suffix }]);
  }

  function removePantone(code: string) {
    onChange(colors.filter((c) => c.pantoneCode !== code));
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {colors.map((c, i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-1.5">
            <input
              type="color"
              value={c.hex}
              onChange={(e) => updateHex(i, e.target.value)}
              className="w-6 h-6 rounded-full border border-border cursor-pointer shrink-0"
              aria-label={`Thread ${i + 1} color`}
            />
            <div className="min-w-0 flex-1">
              {c.pantoneCode ? (
                <>
                  <p className="text-xs font-medium text-foreground truncate">
                    {c.pantoneCode} {c.pantoneSuffix}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">{c.pantoneName}</p>
                </>
              ) : (
                <>
                  <p className="text-xs font-medium text-foreground truncate">
                    Thread {String(i + 1).padStart(2, "0")} — {nearestThreadColorName(c.hex)}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tabular-nums">{c.hex}</p>
                </>
              )}
            </div>
            <button type="button" onClick={() => removeAt(i)} aria-label="Remove thread color" className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {colors.length === 0 && <p className="text-xs text-muted-foreground">No thread colors yet — add one below.</p>}
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        <button
          type="button"
          onClick={() => addHex("#111111")}
          disabled={atMax}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-50 disabled:pointer-events-none"
        >
          <Plus className="w-3.5 h-3.5" /> Add Thread
        </button>
        <PantoneShadePicker selected={colors} onAdd={addPantone} onRemove={removePantone} disabled={atMax} />
      </div>

      {atMax && <p className="text-[10px] text-muted-foreground">Maximum of {MAX_THREAD_COLORS} thread colors reached.</p>}

      <div>
        <p className="text-[10px] text-muted-foreground mb-1.5">Curated palette</p>
        <div className="grid grid-cols-8 gap-1.5">
          {THREAD_COLOR_PALETTE.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.name}
              onClick={() => addHex(c.hex)}
              disabled={atMax}
              className="aspect-square rounded-full border border-border hover:scale-110 transition-transform disabled:opacity-40 disabled:pointer-events-none disabled:hover:scale-100"
              style={{ backgroundColor: c.hex }}
              aria-label={`Add ${c.name}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
