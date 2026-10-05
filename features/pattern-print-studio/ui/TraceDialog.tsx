"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Editor, TraceSource } from "../engine/Editor";
import { rasterize, runTrace, type TraceJob } from "../engine/trace/trace-client";
import { DEFAULT_TRACE, looksPhotographic, type RawImage, type TraceResult, type TraceSettings } from "../engine/trace/trace-core";
import { formatUnits, UNIT_LABEL, type DisplayUnit } from "../engine/units";

/** The live preview traces a small copy; the final trace uses up to this many pixels on the long side. */
const PREVIEW_PX = 420;
const FINAL_PX = 1600;
const PREVIEW_DELAY_MS = 180;

function drawResult(canvas: HTMLCanvasElement, result: TraceResult) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const k = canvas.width / result.width;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  for (const shape of result.shapes) {
    const p = new Path2D();
    for (const sub of shape.subpaths) {
      p.moveTo(sub.start[0], sub.start[1]);
      for (const s of sub.segs) {
        if (s[0] === "L") p.lineTo(s[1], s[2]);
        else p.quadraticCurveTo(s[1], s[2], s[3], s[4]);
      }
      p.closePath();
    }
    const [r, g, b, a] = shape.color;
    ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
    ctx.fill(p, "evenodd");
  }
}

function Slider({ label, value, min, max, onChange, hint }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <label className="grid gap-1 text-xs font-medium" title={hint}>
      <span className="flex justify-between">
        {label} <span className="font-mono text-muted-foreground">{value}</span>
      </span>
      <input type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-primary" />
    </label>
  );
}

type Props = { editor: Editor; unit: DisplayUnit; onClose: () => void; onResult: (r: { ok: boolean; message: string }) => void };

/** Trace bitmap: live side-by-side preview, then a full-quality trace placed exactly over the image. */
export default function TraceDialog(props: Props) {
  return (
    <Dialog open onOpenChange={(o) => !o && props.onClose()}>
      <TraceBody {...props} />
    </Dialog>
  );
}

function TraceBody({ editor, unit, onClose, onResult }: Props) {
  const [source, setSource] = useState<TraceSource | null>(null);
  const [small, setSmall] = useState<{ image: RawImage; scale: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settings, setSettings] = useState<TraceSettings>(DEFAULT_TRACE);
  const [deleteOriginal, setDeleteOriginal] = useState(false);
  const [preview, setPreview] = useState<TraceResult | null>(null);
  const [previewBusy, setPreviewBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ value: number; label: string } | null>(null);
  const originalRef = useRef<HTMLCanvasElement>(null);
  const vectorRef = useRef<HTMLCanvasElement>(null);
  const finalJob = useRef<TraceJob | null>(null);
  const set = (patch: Partial<TraceSettings>) => setSettings((s) => ({ ...s, ...patch }));

  // Load the selected bitmap's original pixels once.
  useEffect(() => {
    let alive = true;
    editor.getTraceSource().then(
      (src) => {
        if (!alive) return;
        if (!src) return setLoadError("Select one imported bitmap (PNG or JPG) first.");
        setSource(src);
        setSmall(rasterize(src.image, PREVIEW_PX));
      },
      () => alive && setLoadError("This bitmap couldn't be read.")
    );
    return () => {
      alive = false;
      finalJob.current?.cancel();
    };
  }, [editor]);

  // Original, drawn once it has loaded.
  useEffect(() => {
    const c = originalRef.current;
    if (!c || !source || !small) return;
    c.width = small.image.width;
    c.height = small.image.height;
    c.getContext("2d")?.drawImage(source.image, 0, 0, c.width, c.height);
  }, [source, small]);

  // Live preview: re-trace the small copy shortly after any setting changes.
  useEffect(() => {
    if (!small) return;
    let job: TraceJob | null = null;
    const timer = setTimeout(() => {
      setPreviewBusy(true);
      job = runTrace(small.image, settings, small.scale);
      job.promise.then(
        (result) => {
          setPreview(result);
          setError(null);
          setPreviewBusy(false);
        },
        (err: Error) => {
          if (err.message === "cancelled") return;
          setError(err.message);
          setPreviewBusy(false);
        }
      );
    }, PREVIEW_DELAY_MS);
    return () => {
      clearTimeout(timer);
      job?.cancel();
    };
  }, [small, settings]);

  useEffect(() => {
    const c = vectorRef.current;
    if (!c || !preview) return;
    c.width = preview.width * 2;
    c.height = preview.height * 2;
    drawResult(c, preview);
  }, [preview]);

  function apply() {
    if (!source) return;
    const full = rasterize(source.image, FINAL_PX);
    setProgress({ value: 0, label: "Starting" });
    const job = runTrace(full.image, settings, full.scale, (value, label) => setProgress({ value, label }));
    finalJob.current = job;
    job.promise.then(
      (result) => {
        finalJob.current = null;
        setProgress(null);
        if (!result.shapes.length) return setError("Nothing was traced with these settings. Try a different threshold or more detail.");
        onResult(editor.placeTrace(source.id, result, deleteOriginal));
        onClose();
      },
      (err: Error) => {
        finalJob.current = null;
        setProgress(null);
        if (err.message !== "cancelled") setError(err.message);
      }
    );
  }

  const photo = small ? looksPhotographic(small.image) : false;
  const checker = "bg-[length:16px_16px] bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%,transparent_75%,#e5e7eb_75%),linear-gradient(45deg,#e5e7eb_25%,#fff_25%,#fff_75%,#e5e7eb_75%)] bg-[position:0_0,8px_8px]";

  return (
    <DialogContent className="sm:max-w-4xl">
      <DialogHeader>
        <DialogTitle>Trace bitmap</DialogTitle>
        <DialogDescription>
          Turns {source ? `“${source.name}”` : "the selected image"} into editable vector shapes, placed exactly over it at the same size
          {source ? ` (${formatUnits(source.widthIn, unit)} × ${formatUnits(source.heightIn, unit)} ${UNIT_LABEL[unit]})` : ""}.
        </DialogDescription>
      </DialogHeader>

      {loadError ? (
        <p className="rounded-md border border-amber-300 px-3 py-2 text-sm text-amber-700">{loadError}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[1fr_230px]">
          <div className="grid grid-cols-2 gap-2">
            {(["Original", "Vector"] as const).map((title) => (
              <figure key={title} className="grid gap-1">
                <figcaption className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  {title}
                  {title === "Vector" && previewBusy && <Loader2 className="h-3 w-3 animate-spin" />}
                  {title === "Vector" && preview && !previewBusy && <span className="font-mono">{preview.shapes.length} shapes</span>}
                </figcaption>
                <div className={cn("flex aspect-square items-center justify-center overflow-hidden rounded-md border border-border", title === "Vector" && settings.removeBackground ? checker : "bg-white")}>
                  <canvas ref={title === "Original" ? originalRef : vectorRef} className="max-h-full max-w-full" aria-label={title === "Original" ? "Original image" : "Traced vector preview"} />
                </div>
              </figure>
            ))}
          </div>

          <div className="grid content-start gap-3">
            <div className="grid grid-cols-2 gap-1 rounded-md border border-border p-1 text-xs" role="radiogroup" aria-label="Trace mode">
              {(
                [
                  ["bw", "Black & white"],
                  ["color", "Colours"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" role="radio" aria-checked={settings.mode === id} onClick={() => set({ mode: id })} className={cn("rounded px-2 py-1.5 font-medium", settings.mode === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">{settings.mode === "bw" ? "For line art and one-colour logos." : "For logos and motifs with a few flat colours."}</p>
            {settings.mode === "bw" ? (
              <Slider label="Threshold" value={settings.threshold} min={1} max={254} onChange={(threshold) => set({ threshold })} hint="Pixels darker than this become black" />
            ) : (
              <Slider label="Colours" value={settings.colors} min={2} max={8} onChange={(colors) => set({ colors })} hint="How many flat colours to keep" />
            )}
            <Slider label="Smoothing" value={settings.smoothing} min={0} max={100} onChange={(smoothing) => set({ smoothing })} hint="Higher = smoother curves and fewer nodes" />
            <Slider label="Detail" value={settings.detail} min={0} max={100} onChange={(detail) => set({ detail })} hint="Higher keeps small specks; lower removes them (despeckle)" />
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={settings.removeBackground} onChange={(e) => set({ removeBackground: e.target.checked })} /> Remove background (white)
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={deleteOriginal} onChange={(e) => setDeleteOriginal(e.target.checked)} /> Delete the original image
            </label>
          </div>
        </div>
      )}

      {photo && !loadError && (
        <p className="flex items-start gap-2 rounded-md border border-amber-300 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Photo-like images don&apos;t trace well. Keep it as a bitmap for printing.
        </p>
      )}
      {error && <p className="rounded-md border border-red-300 px-3 py-2 text-xs text-red-700 dark:text-red-300">{error}</p>}
      {progress && (
        <div className="grid gap-1" role="status" aria-live="polite">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progress.label}…</span>
            <span className="font-mono">{Math.round(progress.value * 100)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded bg-muted">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(progress.value * 100)}%` }} />
          </div>
        </div>
      )}

      <DialogFooter>
        {progress ? (
          <Button variant="outline" onClick={() => finalJob.current?.cancel()}>
            Cancel trace
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button disabled={!source || !preview?.shapes.length} onClick={apply}>
              Trace and place
            </Button>
          </>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
