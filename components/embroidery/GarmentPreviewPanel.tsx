"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getGarmentDesignsAction, type GarmentDesignSummary } from "@/services/garment-studio";
import { GARMENT_TYPES, PLACEMENT_OPTIONS, THREAD_COLOR_PALETTE, type GarmentTypeId, type PlacementId } from "@/lib/embroidery-production";

export interface GarmentPreviewState {
  garmentId: string | null;
  garmentImage: string | null;
  placement: PlacementId;
  sizePercent: number;
  offsetX: number; // -20..20, % of image width
  offsetY: number; // -20..20, % of image height
  rotation: number; // 0..360
}

export const DEFAULT_GARMENT_PREVIEW: GarmentPreviewState = {
  garmentId: null,
  garmentImage: null,
  placement: "left-chest",
  sizePercent: 100,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
};

/** The Garment tab's content — choosing a real saved AI Garment Studio
 * design for the quick preview (Design Settings panel handles scale/
 * rotation/position/placement), plus garment type/color as production-
 * reference metadata only. Metadata never swaps the preview image — there
 * is no stock mockup library, so it's saved alongside the project instead
 * of pretending to re-render a different garment. */
export function GarmentPreviewPanel({
  state,
  onChange,
  garmentType,
  garmentColor,
  onGarmentTypeChange,
  onGarmentColorChange,
  embroideryDesignId,
  dirty,
}: {
  state: GarmentPreviewState;
  onChange: (state: GarmentPreviewState) => void;
  garmentType: GarmentTypeId | null;
  garmentColor: string | null;
  onGarmentTypeChange: (type: GarmentTypeId) => void;
  onGarmentColorChange: (hex: string) => void;
  embroideryDesignId: string | null;
  /** True when there are unsaved changes — the Garment Studio hand-off
   * fetches the design fresh from the database by id, so it must not be
   * offered as a live link while in-memory edits haven't been persisted
   * yet (it would silently apply the stale last-saved version). */
  dirty: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [garments, setGarments] = useState<GarmentDesignSummary[] | null>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    getGarmentDesignsAction("all").then((result) => {
      if (result.success) setGarments(result.data);
    });
  }, [pickerOpen]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Preview garment</p>
        {state.garmentImage && (
          <div className="mb-2 rounded-lg overflow-hidden border border-border w-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={state.garmentImage} alt="Selected garment" className="w-full aspect-[3/4] object-cover" />
          </div>
        )}
        <Button variant="outline" size="sm" className="w-full" onClick={() => setPickerOpen(true)}>
          <Shirt className="w-3.5 h-3.5" /> {state.garmentImage ? "Change garment" : "Choose a garment"}
        </Button>
        <p className="mt-1 text-[11px] text-muted-foreground">From your saved AI Garment Studio designs.</p>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Garment type</p>
        <Select value={garmentType ?? undefined} onValueChange={(v) => v && onGarmentTypeChange(v as GarmentTypeId)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {GARMENT_TYPES.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Garment color</p>
        <div className="grid grid-cols-8 gap-1.5">
          {[...THREAD_COLOR_PALETTE, { name: "Custom", hex: garmentColor ?? "#111111" }].slice(0, 8).map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.name}
              onClick={() => onGarmentColorChange(c.hex)}
              className="aspect-square rounded-full border-2 transition-transform hover:scale-110"
              style={{ backgroundColor: c.hex, borderColor: garmentColor === c.hex ? "var(--primary)" : "var(--border)" }}
              aria-label={c.name}
            />
          ))}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">Saved as production reference — doesn&apos;t change the preview image above.</p>
      </div>

      {state.garmentId && embroideryDesignId && !dirty ? (
        <Link
          href={`/design-studio/garment/${state.garmentId}?tool=prints-logos&embroideryId=${embroideryDesignId}`}
          className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-primary hover:bg-accent transition-colors"
        >
          Apply in AI Garment Studio <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {state.garmentId && embroideryDesignId && dirty
            ? "Save your changes to apply this design in AI Garment Studio."
            : "Save this project and choose a garment to apply it in AI Garment Studio."}
        </p>
      )}

      <GarmentPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} garments={garments} onPick={(g) => onChange({ ...state, garmentId: g.id, garmentImage: g.image })} />
    </div>
  );
}

function GarmentPickerDialog({
  open,
  onOpenChange,
  garments,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  garments: GarmentDesignSummary[] | null;
  onPick: (g: GarmentDesignSummary) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose a garment</DialogTitle>
          <DialogDescription>Pick a saved AI Garment Studio design to preview this embroidery on.</DialogDescription>
        </DialogHeader>
        {garments === null ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : garments.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No saved garments yet — create one in AI Garment Studio.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-80 overflow-y-auto scrollbar-thin">
            {garments.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  onPick(g);
                  onOpenChange(false);
                }}
                className="rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.image} alt={g.name} className="w-full aspect-[3/4] object-cover" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The actual visual overlay — CSS-positioned, client-only, clearly not an
 * AI composite. Real drag-to-reposition (pointer events, writing straight
 * back into the same GarmentPreviewState the Design Settings sliders use —
 * no separate/duplicated position state) plus a selection bounding box,
 * matching a real editor's interaction model. */
export function GarmentPreviewCanvas({
  state,
  onChange,
  embroideryImage,
  zoom = 100,
}: {
  state: GarmentPreviewState;
  onChange: (state: GarmentPreviewState) => void;
  embroideryImage: string;
  zoom?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null);
  const [selected, setSelected] = useState(false);

  useEffect(() => {
    function handlePointerMove(e: PointerEvent) {
      if (!dragRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dxPercent = ((e.clientX - dragRef.current.startX) / rect.width) * 100;
      const dyPercent = ((e.clientY - dragRef.current.startY) / rect.height) * 100;
      onChange({
        ...state,
        offsetX: Math.max(-20, Math.min(20, dragRef.current.startOffsetX + dxPercent)),
        offsetY: Math.max(-20, Math.min(20, dragRef.current.startOffsetY + dyPercent)),
      });
    }
    function handlePointerUp() {
      dragRef.current = null;
    }
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!state.garmentImage) {
    return (
      <div className="flex h-full items-center justify-center text-center px-6">
        <p className="text-sm text-muted-foreground">Choose a garment from the Garment tab to see a placement preview.</p>
      </div>
    );
  }

  const base = PLACEMENT_OPTIONS.find((p) => p.id === state.placement) ?? PLACEMENT_OPTIONS[0];
  const top = base.previewTop + state.offsetY;
  const left = base.previewLeft + state.offsetX;
  const width = 22 * (state.sizePercent / 100); // % of container width at 100%

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-auto" onClick={() => setSelected(false)}>
      <div
        ref={containerRef}
        className="relative shrink-0 h-full max-h-full"
        style={{ aspectRatio: "3/4", transform: `scale(${zoom / 100})`, transformOrigin: "center" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={state.garmentImage} alt="Garment" className="w-full h-full object-cover rounded-lg select-none" draggable={false} />
        <div
          role="button"
          tabIndex={0}
          onPointerDown={(e) => {
            e.stopPropagation();
            setSelected(true);
            dragRef.current = { startX: e.clientX, startY: e.clientY, startOffsetX: state.offsetX, startOffsetY: state.offsetY };
          }}
          onClick={(e) => e.stopPropagation()}
          className={`absolute cursor-move ${selected ? "outline outline-1 outline-primary outline-offset-4" : ""}`}
          style={{
            top: `${top}%`,
            left: `${left}%`,
            width: `${width}%`,
            transform: `translate(-50%, -50%) rotate(${state.rotation}deg)`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={embroideryImage} alt="Embroidery placement preview" className="w-full pointer-events-none drop-shadow-md select-none" draggable={false} />
        </div>
      </div>
    </div>
  );
}
