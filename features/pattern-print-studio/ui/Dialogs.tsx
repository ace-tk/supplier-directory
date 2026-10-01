"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ParsedVectorImport } from "../engine/import-svg";
import type { ParsedRasterImport } from "../engine/import-raster";
import { loadPresets, savePresets, type PagePreset } from "../engine/storage";
import type { PageSize } from "../engine/types";
import {
  CSS_PX_PER_INCH,
  formatUnits,
  parseLength,
  UNIT_LABEL,
  type DisplayUnit,
} from "../engine/units";

const fieldCls =
  "h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary";

// ---------------------------------------------------------------- New document

type NewDocProps = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (page: PageSize, units: DisplayUnit, name: string) => void;
};

export function NewDocumentDialog(props: NewDocProps) {
  // The body only mounts while open, so its form starts fresh every time.
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open && <NewDocumentBody {...props} />}
    </Dialog>
  );
}

function NewDocumentBody({ onOpenChange, onCreate }: NewDocProps) {
  const [presets, setPresets] = useState<PagePreset[]>(() => loadPresets());
  const [unit, setUnit] = useState<DisplayUnit>("in");
  const [w, setW] = useState("163.750");
  const [h, setH] = useState("37.694");
  const [name, setName] = useState("Leggings program");

  const width = parseLength(w, unit);
  const height = parseLength(h, unit);
  const valid = width !== null && height !== null && width > 0 && height > 0;

  const apply = (p: PagePreset) => {
    setUnit(p.units);
    setW(formatUnits(p.page.width, p.units));
    setH(formatUnits(p.page.height, p.units));
    setName(p.name);
  };
  const updatePresets = (next: PagePreset[]) => {
    setPresets(next);
    savePresets(next);
  };

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>New document</DialogTitle>
        <DialogDescription>
          Page size is stored exactly; units only change how numbers are shown.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 py-1">
        <label className="grid gap-1 text-xs font-medium">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldCls}
          />
        </label>
        <div className="grid grid-cols-[1fr_1fr_120px] gap-2">
          <label className="grid gap-1 text-xs font-medium">
            Width
            <input
              value={w}
              onChange={(e) => setW(e.target.value)}
              className={fieldCls}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Height
            <input
              value={h}
              onChange={(e) => setH(e.target.value)}
              className={fieldCls}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Units
            <select
              value={unit}
              onChange={(e) => {
                const next = e.target.value as DisplayUnit;
                if (width !== null) setW(formatUnits(width, next));
                if (height !== null) setH(formatUnits(height, next));
                setUnit(next);
              }}
              className={fieldCls}
            >
              <option value="in">inches</option>
              <option value="cm">centimeters</option>
              <option value="mm">millimeters</option>
            </select>
          </label>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-medium">Presets</p>
            <Button
              variant="outline"
              size="xs"
              disabled={!valid}
              onClick={() =>
                valid &&
                updatePresets([
                  ...presets,
                  {
                    name: name.trim() || "Custom",
                    page: { width: width!, height: height! },
                    units: unit,
                  },
                ])
              }
            >
              <Plus className="h-3 w-3" /> Save current as preset
            </Button>
          </div>
          <ul className="max-h-40 divide-y divide-border overflow-y-auto rounded-md border border-border">
            {presets.map((p, i) => (
              <li
                key={`${p.name}-${i}`}
                className="flex items-center gap-2 px-2 py-1.5 text-xs"
              >
                <button
                  type="button"
                  onClick={() => apply(p)}
                  className="min-w-0 flex-1 truncate text-left hover:text-primary"
                >
                  <span className="font-medium">{p.name}</span>{" "}
                  <span className="text-muted-foreground">
                    {formatUnits(p.page.width, p.units)} ×{" "}
                    {formatUnits(p.page.height, p.units)} {UNIT_LABEL[p.units]}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete preset ${p.name}`}
                  onClick={() =>
                    updatePresets(presets.filter((_, j) => j !== i))
                  }
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          disabled={!valid}
          onClick={() =>
            valid &&
            onCreate(
              { width: width!, height: height! },
              unit,
              name.trim() || "Untitled",
            )
          }
        >
          Create
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ---------------------------------------------------------------- Import

export type PendingImport =
  (ParsedVectorImport & { pageCount?: number }) | ParsedRasterImport;

type ImportProps = {
  pending: PendingImport | null;
  unit: DisplayUnit;
  onCancel: () => void;
  onPlaceVector: (opts: { scale: number; keepPosition: boolean }) => void;
  onPlaceRaster: (dpi: number) => void;
  onChangePdfPage: (page: number) => void;
};

export function ImportDialog(props: ImportProps) {
  if (!props.pending) return null;
  // Keyed by file so options reset for each new import (a PDF page change keeps them).
  return (
    <ImportBody
      key={props.pending.fileName}
      {...props}
      pending={props.pending}
    />
  );
}

function ImportBody({
  pending,
  unit,
  onCancel,
  onPlaceVector,
  onPlaceRaster,
  onChangePdfPage,
}: ImportProps & { pending: PendingImport }) {
  const [keepSize, setKeepSize] = useState(true);
  const [keepPosition, setKeepPosition] = useState(true);
  const [scalePct, setScalePct] = useState("100");
  const [dpi, setDpi] = useState(() =>
    pending.kind === "raster" ? String(pending.detectedDpi ?? 300) : "300",
  );

  const dpiNum = parseFloat(dpi);
  const rasterSize = useMemo(() => {
    if (pending.kind !== "raster" || !(dpiNum > 0)) return null;
    return {
      w: pending.asset.pxWidth / dpiNum,
      h: pending.asset.pxHeight / dpiNum,
    };
  }, [pending, dpiNum]);

  const scale = keepSize ? 1 : (parseFloat(scalePct) || 100) / 100;

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import “{pending.fileName}”</DialogTitle>
          <DialogDescription>
            {pending.kind === "raster"
              ? "Bitmap — real size comes from its DPI."
              : `Vector ${pending.kind.toUpperCase()} — imported at real-world size.`}
          </DialogDescription>
        </DialogHeader>

        {pending.kind === "raster" ? (
          <div className="grid gap-3 py-1 text-sm">
            <p>
              <span className="text-muted-foreground">Pixels:</span>{" "}
              {pending.asset.pxWidth} × {pending.asset.pxHeight}
            </p>
            <label className="grid gap-1 text-xs font-medium">
              Resolution (DPI){" "}
              {pending.detectedDpi ? (
                <span className="font-normal text-muted-foreground">
                  — {pending.detectedDpi} stored in the file
                </span>
              ) : (
                <span className="font-normal text-amber-600">
                  — not stored in the file, please confirm
                </span>
              )}
              <input
                value={dpi}
                onChange={(e) => setDpi(e.target.value)}
                className={fieldCls}
              />
            </label>
            <p>
              <span className="text-muted-foreground">Real size:</span>{" "}
              {rasterSize ? (
                <strong>
                  {formatUnits(rasterSize.w, unit)} ×{" "}
                  {formatUnits(rasterSize.h, unit)} {UNIT_LABEL[unit]}
                </strong>
              ) : (
                "—"
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              The canvas shows a lightweight preview; the original file is kept
              for export.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 py-1 text-sm">
            {pending.kind === "pdf" && (pending.pageCount ?? 1) > 1 && (
              <label className="grid gap-1 text-xs font-medium">
                Page
                <select
                  onChange={(e) => onChangePdfPage(Number(e.target.value))}
                  className={fieldCls}
                  defaultValue="1"
                >
                  {Array.from({ length: pending.pageCount ?? 1 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      Page {i + 1}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p>
              <span className="text-muted-foreground">Detected size:</span>{" "}
              <strong>
                {formatUnits(pending.widthIn, unit)} ×{" "}
                {formatUnits(pending.heightIn, unit)} {UNIT_LABEL[unit]}
              </strong>
            </p>
            <p className="break-all font-mono text-[11px] text-muted-foreground">
              {pending.detail}
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={keepSize}
                onChange={(e) => setKeepSize(e.target.checked)}
              />{" "}
              Keep original size
            </label>
            {!keepSize && (
              <label className="grid gap-1 text-xs font-medium">
                Scale (%)
                <input
                  value={scalePct}
                  onChange={(e) => setScalePct(e.target.value)}
                  className={fieldCls}
                />
              </label>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={keepPosition}
                onChange={(e) => setKeepPosition(e.target.checked)}
              />{" "}
              Same position as in the file (file page → this page)
            </label>
            {pending.warnings.length > 0 && (
              <ul className="list-disc space-y-1 rounded-md bg-amber-50 py-2 pl-6 pr-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                {pending.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          {pending.kind === "raster" ? (
            <Button
              disabled={!(dpiNum > 0)}
              onClick={() => onPlaceRaster(dpiNum)}
            >
              Import
            </Button>
          ) : (
            <Button
              disabled={!(scale > 0)}
              onClick={() => onPlaceVector({ scale, keepPosition })}
            >
              Import
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Calibrate

type CalibrateProps = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  calibration: number;
  onApply: (factor: number) => void;
};

export function CalibrateDialog(props: CalibrateProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open && <CalibrateBody {...props} />}
    </Dialog>
  );
}

function CalibrateBody({ calibration, onApply }: CalibrateProps) {
  const [measured, setMeasured] = useState("5");
  const [unit, setUnit] = useState<DisplayUnit>("in");
  const lineCssPx = 5 * CSS_PX_PER_INCH * calibration;
  const measuredIn = parseLength(measured, unit);
  const next =
    measuredIn && measuredIn > 0 ? calibration * (5 / measuredIn) : null;

  return (
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Calibrate screen</DialogTitle>
        <DialogDescription>
          Hold a real ruler against the line below and type its actual length.
          After calibrating, 100% zoom shows objects at true size on this
          screen. (Exports are always exact — this only affects the on-screen
          view.)
        </DialogDescription>
      </DialogHeader>
      <div className="overflow-x-auto py-3">
        <div className="relative h-10" style={{ width: lineCssPx + 2 }}>
          <div
            className="absolute left-0 top-4 h-0.5 bg-foreground"
            style={{ width: lineCssPx }}
          />
          <div className="absolute left-0 top-1 h-6 w-0.5 bg-foreground" />
          <div
            className="absolute top-1 h-6 w-0.5 bg-foreground"
            style={{ left: lineCssPx - 1 }}
          />
          <span className="absolute left-1/2 top-6 -translate-x-1/2 text-xs text-muted-foreground">
            should be 5 inches (12.7 cm)
          </span>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_140px] gap-2">
        <label className="grid gap-1 text-xs font-medium">
          Measured length
          <input
            value={measured}
            onChange={(e) => setMeasured(e.target.value)}
            className={fieldCls}
          />
        </label>
        <label className="grid gap-1 text-xs font-medium">
          Units
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as DisplayUnit)}
            className={fieldCls}
          >
            <option value="in">inches</option>
            <option value="cm">centimeters</option>
            <option value="mm">millimeters</option>
          </select>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Current screen factor: {calibration.toFixed(4)}
        {next ? ` → new factor: ${next.toFixed(4)}` : ""}
      </p>
      <DialogFooter>
        <Button variant="outline" onClick={() => onApply(1)}>
          Reset to 96 DPI
        </Button>
        <Button disabled={!next} onClick={() => next && onApply(next)}>
          Apply
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
