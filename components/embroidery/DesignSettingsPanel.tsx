"use client";

import {
  AlignCenter,
  AlignCenterVertical,
  AlignEndVertical,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  Maximize,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingSlider } from "@/components/garment-studio/ToolControls";
import { PLACEMENT_OPTIONS, type PlacementId } from "@/lib/embroidery-production";
import type { GarmentPreviewState } from "@/components/embroidery/GarmentPreviewPanel";

const ALIGN_EXTENT = 20;

export function DesignSettingsPanel({ state, onChange }: { state: GarmentPreviewState; onChange: (state: GarmentPreviewState) => void }) {
  const base = PLACEMENT_OPTIONS.find((p) => p.id === state.placement) ?? PLACEMENT_OPTIONS[0];

  return (
    <div className="space-y-4">
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
        <p className="mt-1 text-[11px] text-muted-foreground">Reference size: {base.baseWidthMm} × {base.baseHeightMm} mm at 100% scale.</p>
      </div>

      <SettingSlider label="Scale" value={state.sizePercent} unit="%" min={50} max={150} onChange={(v) => onChange({ ...state, sizePercent: v })} />
      <SettingSlider label="Rotation" value={state.rotation} unit="°" min={0} max={360} onChange={(v) => onChange({ ...state, rotation: v })} />
      <SettingSlider label="Position X" value={state.offsetX} unit="" min={-ALIGN_EXTENT} max={ALIGN_EXTENT} onChange={(v) => onChange({ ...state, offsetX: v })} />
      <SettingSlider label="Position Y" value={state.offsetY} unit="" min={-ALIGN_EXTENT} max={ALIGN_EXTENT} onChange={(v) => onChange({ ...state, offsetY: v })} />

      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Alignment</p>
        <div className="grid grid-cols-3 gap-1.5">
          <Button variant="outline" size="icon-xs" title="Align left" onClick={() => onChange({ ...state, offsetX: -ALIGN_EXTENT })}>
            <AlignLeft className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="icon-xs" title="Align horizontal center" onClick={() => onChange({ ...state, offsetX: 0 })}>
            <AlignCenter className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="icon-xs" title="Align right" onClick={() => onChange({ ...state, offsetX: ALIGN_EXTENT })}>
            <AlignRight className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="icon-xs" title="Align top" onClick={() => onChange({ ...state, offsetY: -ALIGN_EXTENT })}>
            <AlignStartVertical className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="icon-xs" title="Align middle" onClick={() => onChange({ ...state, offsetY: 0 })}>
            <AlignCenterVertical className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="icon-xs" title="Align bottom" onClick={() => onChange({ ...state, offsetY: ALIGN_EXTENT })}>
            <AlignEndVertical className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => onChange({ ...state, offsetX: 0, offsetY: 0 })}>
          Center
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => onChange({ ...state, sizePercent: 100 })}>
          <Maximize className="w-3.5 h-3.5" /> Fit
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => onChange({ ...state, sizePercent: 100, offsetX: 0, offsetY: 0, rotation: 0 })}>
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </Button>
      </div>
    </div>
  );
}
