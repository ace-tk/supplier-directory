"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw, X } from "lucide-react";
import { THREAD_COLOR_PALETTE, MAX_THREAD_COLORS, nearestThreadColorName, type ThreadColor } from "@/lib/embroidery-production";
import { PantoneShadePicker } from "@/components/embroidery/PantoneShadePicker";
import { Button } from "@/components/ui/button";
import { swapThreadColor } from "@/lib/garment-canvas";
import type { PantoneColor } from "@/lib/pantone/types";

export function ThreadColorsPanel({
  colors,
  onChange,
  embroideryImage,
  onEmbroideryImageChange,
}: {
  colors: ThreadColor[];
  onChange: (colors: ThreadColor[]) => void;
  /** The rendered embroidery preview — Quick Color Swap recolors this
   * bitmap directly. Swap is only offered once one exists. */
  embroideryImage: string | null;
  onEmbroideryImageChange: (dataUrl: string) => void;
}) {
  const atMax = colors.length >= MAX_THREAD_COLORS;
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [draftHex, setDraftHex] = useState("#111111");
  const [swapBusyIndex, setSwapBusyIndex] = useState<number | null>(null);

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
    if (swapIndex === i) setSwapIndex(null);
  }

  function addPantone(color: PantoneColor) {
    if (atMax || colors.some((c) => c.pantoneCode === color.code)) return;
    onChange([...colors, { hex: color.hex, pantoneCode: color.code, pantoneName: color.name, pantoneSystem: color.system, pantoneSuffix: color.suffix }]);
  }

  function removePantone(code: string) {
    onChange(colors.filter((c) => c.pantoneCode !== code));
  }

  function openSwap(i: number) {
    setDraftHex(colors[i].hex);
    setSwapIndex(swapIndex === i ? null : i);
  }

  /** Quick Color Swap — deterministic, local Canvas 2D recolor of the
   * existing embroidery preview (see lib/garment-canvas.ts). No AI call.
   * Replaces this slot's ThreadColor in the same state the rest of the
   * editor already reads/persists/undoes, exactly like every other
   * thread-color edit above. */
  async function applySwap(i: number, replacement: ThreadColor) {
    if (!embroideryImage) return;
    if (replacement.pantoneCode && colors.some((c, idx) => idx !== i && c.pantoneCode === replacement.pantoneCode)) {
      toast.error("That Pantone shade is already in this palette.");
      return;
    }
    setSwapBusyIndex(i);
    try {
      const result = await swapThreadColor(embroideryImage, colors[i].hex, replacement.hex);
      if (!result.matched) {
        toast.error("That color wasn't found in the current embroidery preview.");
        return;
      }
      onEmbroideryImageChange(result.dataUrl);
      const next = [...colors];
      next[i] = replacement;
      onChange(next);
      setSwapIndex(null);
    } finally {
      setSwapBusyIndex(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {colors.map((c, i) => (
          <div key={i} className="rounded-lg border border-border px-2.5 py-1.5">
            <div className="flex items-center gap-2.5">
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
              {embroideryImage && (
                <button
                  type="button"
                  onClick={() => openSwap(i)}
                  aria-label="Quick color swap"
                  aria-pressed={swapIndex === i}
                  title="Quick Color Swap"
                  className="text-muted-foreground hover:text-foreground shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
              <button type="button" onClick={() => removeAt(i)} aria-label="Remove thread color" className="text-muted-foreground hover:text-foreground shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {swapIndex === i && (
              <div className="mt-2 pt-2 border-t border-border/60 space-y-2">
                <p className="text-[10px] font-medium text-muted-foreground">Quick Color Swap — replace this thread everywhere it appears in the preview.</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={draftHex}
                    onChange={(e) => setDraftHex(e.target.value)}
                    className="w-6 h-6 rounded-full border border-border cursor-pointer shrink-0"
                    aria-label="Replacement color"
                  />
                  <Button type="button" size="sm" onClick={() => applySwap(i, { hex: draftHex })} disabled={swapBusyIndex === i}>
                    {swapBusyIndex === i ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Apply swap
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSwapIndex(null)}>
                    Cancel
                  </Button>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Or swap to a Pantone shade:</p>
                  <PantoneShadePicker
                    selected={[]}
                    onAdd={(color) => applySwap(i, { hex: color.hex, pantoneCode: color.code, pantoneName: color.name, pantoneSystem: color.system, pantoneSuffix: color.suffix })}
                    onRemove={() => {}}
                  />
                </div>
              </div>
            )}
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
