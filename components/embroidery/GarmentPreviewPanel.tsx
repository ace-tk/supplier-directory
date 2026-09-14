"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingSlider } from "@/components/garment-studio/ToolControls";
import { getGarmentDesignsAction, type GarmentDesignSummary } from "@/services/garment-studio";
import { PLACEMENT_OPTIONS, type PlacementId } from "@/lib/embroidery-production";

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

/** Controls for Stage 5 — the actual visual overlay renders in the page's
 * main canvas (GarmentPreviewCanvas below), since the canvas needs to sit
 * next to the before/after artwork view, not inside this side panel. */
export function GarmentPreviewPanel({
  state,
  onChange,
  embroideryDesignId,
}: {
  state: GarmentPreviewState;
  onChange: (state: GarmentPreviewState) => void;
  /** Passed once the project is saved, so "Apply in AI Garment Studio" can
   * hand off the real converted image by id instead of a giant URL. */
  embroideryDesignId: string | null;
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
    <div className="space-y-4">
      <p className="text-sm font-semibold text-foreground">Garment Preview</p>

      <Button variant="outline" size="sm" className="w-full" onClick={() => setPickerOpen(true)}>
        <Shirt className="w-3.5 h-3.5" /> {state.garmentImage ? "Change garment" : "Choose a garment"}
      </Button>

      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Placement</p>
        <Select value={state.placement} onValueChange={(v) => v && onChange({ ...state, placement: v as PlacementId })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLACEMENT_OPTIONS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <SettingSlider label="Size" value={state.sizePercent} unit="%" min={50} max={150} onChange={(v) => onChange({ ...state, sizePercent: v })} />
      <SettingSlider label="Position (horizontal)" value={state.offsetX} unit="" min={-20} max={20} onChange={(v) => onChange({ ...state, offsetX: v })} />
      <SettingSlider label="Position (vertical)" value={state.offsetY} unit="" min={-20} max={20} onChange={(v) => onChange({ ...state, offsetY: v })} />
      <SettingSlider label="Rotation" value={state.rotation} unit="°" min={0} max={360} onChange={(v) => onChange({ ...state, rotation: v })} />

      <p className="text-[11px] text-muted-foreground">
        This is a quick approximate preview. For a realistic, garment-fold-aware composite, apply it in AI Garment Studio&apos;s Prints/Logos tool.
      </p>

      {state.garmentId && embroideryDesignId ? (
        <Link
          href={`/design-studio/garment/${state.garmentId}?tool=prints-logos&embroideryId=${embroideryDesignId}`}
          className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-primary hover:bg-accent transition-colors"
        >
          Apply in AI Garment Studio <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      ) : (
        <p className="text-[11px] text-muted-foreground">Save this project and choose a garment to enable applying it in AI Garment Studio.</p>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
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
                    onChange({ ...state, garmentId: g.id, garmentImage: g.image });
                    setPickerOpen(false);
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
    </div>
  );
}

/** The actual visual overlay — CSS-positioned, client-only, clearly not an
 * AI composite. Placement presets give a starting position; the user's
 * Size/Position/Rotation controls adjust it from there. */
export function GarmentPreviewCanvas({ state, embroideryImage }: { state: GarmentPreviewState; embroideryImage: string }) {
  if (!state.garmentImage) {
    return (
      <div className="flex h-full items-center justify-center text-center px-6">
        <p className="text-sm text-muted-foreground">Choose a garment from the panel to see a quick placement preview.</p>
      </div>
    );
  }

  const base = PLACEMENT_OPTIONS.find((p) => p.id === state.placement) ?? PLACEMENT_OPTIONS[0];
  const top = base.previewTop + state.offsetY;
  const left = base.previewLeft + state.offsetX;
  const width = 22 * (state.sizePercent / 100); // % of container width at 100%

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-muted/30">
      <div className="relative h-full max-h-full aspect-[3/4]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={state.garmentImage} alt="Garment" className="w-full h-full object-cover rounded-lg" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={embroideryImage}
          alt="Embroidery placement preview"
          className="absolute pointer-events-none drop-shadow-md"
          style={{
            top: `${top}%`,
            left: `${left}%`,
            width: `${width}%`,
            transform: `translate(-50%, -50%) rotate(${state.rotation}deg)`,
          }}
        />
      </div>
    </div>
  );
}
