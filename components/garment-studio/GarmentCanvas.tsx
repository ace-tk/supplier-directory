"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { toast } from "sonner";
import { Pencil, Eraser, Square, PenTool, Move, Undo2, MoreHorizontal, Trash2, Wand2 } from "lucide-react";
import { autoSelectMaskAction, type SegmentPoint } from "@/services/garment-segmentation";
import {
  loadBoundedImage,
  loadImage,
  canvasToBlob,
  screenToCanvasPoint,
  MaskBuffer,
  renderPatternPreview,
  renderColorizePreview,
  compositeMaskedEdit,
  fitLogoScalePercent,
  type MaskTool,
} from "@/lib/garment-canvas";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

export interface PatternPreviewConfig {
  kind: "pattern" | "logo";
  patternDataUrl: string;
  scalePercent: number;
  rotationDeg: number;
  brightnessPercent: number;
  offsetX: number;
  offsetY: number;
}

export interface ColorizePreviewConfig {
  kind: "colorize";
  colorHex: string;
  brightnessPercent: number;
}

export type PreviewConfig = PatternPreviewConfig | ColorizePreviewConfig | null;

export interface GarmentCanvasHandle {
  getImageBlob: () => Promise<Blob>;
  getMaskBlob: () => Promise<Blob>;
  isMaskEmpty: () => boolean;
  clearMask: () => void;
  /** The canvas's current source-image pixel dimensions — pass to the
   * server action so it can request an AI edit size matching the actual
   * aspect ratio instead of an arbitrary hardcoded one. */
  getDimensions: () => { width: number; height: number };
  /** Caps a requested Prints/Logos scale% to the current mask's own
   * bounding box (see lib/garment-canvas.ts fitLogoScalePercent) — call
   * right before applyPrintLogoAction so the AI is never asked for a
   * placement larger than what the user actually masked. */
  getFittedLogoScalePercent: (requestedScalePercent: number, logoNaturalWidth: number, logoNaturalHeight: number) => number;
  /** Rebuilds the AI's raw edit result against the original image so
   * pixels outside the mask are guaranteed to be the original's exact
   * pixels — see lib/garment-canvas.ts compositeMaskedEdit. Must be
   * called before persisting any masked-edit result. Returns a Blob (not
   * a data URL string) — see compositeMaskedEdit's doc comment for why. */
  compositeWithAiResult: (aiResultDataUrl: string) => Promise<Blob>;
}

interface GarmentCanvasProps {
  imageUrl: string;
  thumbnailUrl: string;
  preview: PreviewConfig;
  onPatternOffsetChange?: (offsetX: number, offsetY: number) => void;
  /** Fires whenever an Auto Select (SAM 2) request starts/finishes, so the
   * page can temporarily disable Save/Colorize/etc. — the mask a save
   * would read is only trustworthy once the in-flight selection request
   * has actually applied its result. */
  onAutoSelectBusyChange?: (busy: boolean) => void;
}

export const GarmentCanvas = forwardRef<GarmentCanvasHandle, GarmentCanvasProps>(function GarmentCanvas(
  { imageUrl, thumbnailUrl, preview, onPatternOffsetChange, onAutoSelectBusyChange },
  ref
) {
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskRef = useRef<MaskBuffer | null>(null);
  const undoStackRef = useRef<ImageData[]>([]);
  const patternImageRef = useRef<HTMLImageElement | null>(null);

  const [tool, setTool] = useState<MaskTool>("brush");
  const [brushSize, setBrushSize] = useState(40);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [loaded, setLoaded] = useState(false);

  // Auto Select (SAM 2) — a running list of click points for the current
  // selection session, sent in full on every click so SAM 2 can refine the
  // same selection (Add/Subtract), exactly like Photoshop's own object
  // selection tool. Reset whenever the tool changes or the mask is cleared.
  const autoSelectPointsRef = useRef<SegmentPoint[]>([]);
  const [autoSelectMode, setAutoSelectMode] = useState<"add" | "subtract">("add");
  const [autoSelectStatus, setAutoSelectStatus] = useState<"idle" | "running" | "ready" | "error">("idle");

  // Adjust-during-render: reset the loading flag the instant imageUrl
  // changes (e.g. a different history version was selected), rather than
  // a synchronous setState at the top of the effect below — React treats
  // this comparison-then-setState-during-render as a supported pattern,
  // unlike a direct setState call inside an effect body.
  const [prevImageUrl, setPrevImageUrl] = useState(imageUrl);
  if (imageUrl !== prevImageUrl) {
    setPrevImageUrl(imageUrl);
    setLoaded(false);
  }

  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const polygonPointsRef = useRef<{ x: number; y: number }[]>([]);
  const moveStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadBoundedImage(imageUrl).then(({ canvas, width, height }) => {
      if (cancelled) return;
      baseCanvasRef.current = canvas;
      maskRef.current = new MaskBuffer(width, height);
      undoStackRef.current = [];
      autoSelectPointsRef.current = [];
      setAutoSelectStatus("idle");
      setDimensions({ width, height });
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  useEffect(() => {
    if (preview && (preview.kind === "pattern" || preview.kind === "logo")) {
      loadImage(preview.patternDataUrl).then((img) => {
        patternImageRef.current = img;
        redraw();
      });
    } else {
      patternImageRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview && preview.kind !== "colorize" ? preview.patternDataUrl : null]);

  function redraw() {
    const canvas = displayCanvasRef.current;
    const base = baseCanvasRef.current;
    const mask = maskRef.current;
    if (!canvas || !base || !mask) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (preview?.kind === "pattern" || preview?.kind === "logo") {
      const img = patternImageRef.current;
      if (img) {
        // Prints/Logos (unlike an intentionally-repeating Pattern) is a
        // single placement — cap its scale to the mask's own bounding box
        // so the preview shows exactly what will actually be requested/
        // rendered (see fitLogoScalePercent's doc comment).
        const scalePercent =
          preview.kind === "logo"
            ? fitLogoScalePercent(preview.scalePercent, canvas.width, canvas.height, mask.boundingBox(), img.naturalWidth, img.naturalHeight)
            : preview.scalePercent;
        renderPatternPreview(ctx, canvas.width, canvas.height, base, mask, img, {
          scalePercent,
          rotationDeg: preview.rotationDeg,
          brightnessPercent: preview.brightnessPercent,
          offsetX: preview.offsetX,
          offsetY: preview.offsetY,
        });
      } else {
        ctx.drawImage(base, 0, 0);
      }
    } else if (preview?.kind === "colorize") {
      renderColorizePreview(ctx, canvas.width, canvas.height, base, mask, {
        colorHex: preview.colorHex,
        brightnessPercent: preview.brightnessPercent,
      });
    } else {
      ctx.drawImage(base, 0, 0);
    }

    mask.drawOverlay(ctx);

    if (tool === "polygon" && polygonPointsRef.current.length > 0) {
      ctx.strokeStyle = "rgba(99,102,241,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const pts = polygonPointsRef.current;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "rgb(99,102,241)";
        ctx.fill();
      }
    }
  }

  useEffect(() => {
    if (loaded) redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, preview, tool]);

  // Every tool switch starts a fresh Auto Select session — a point history
  // from a previous session (or a different tool's manual edits in
  // between) shouldn't silently keep refining a selection the user can no
  // longer see the context for. Adjust-during-render (see prevImageUrl
  // above) rather than a setState-in-effect, for the same reason.
  const [prevTool, setPrevTool] = useState<MaskTool>(tool);
  if (tool !== prevTool) {
    setPrevTool(tool);
    autoSelectPointsRef.current = [];
    setAutoSelectStatus("idle");
  }

  useEffect(() => {
    onAutoSelectBusyChange?.(autoSelectStatus === "running");
  }, [autoSelectStatus, onAutoSelectBusyChange]);

  function pushUndoSnapshot() {
    const mask = maskRef.current;
    if (!mask) return;
    const ctx = mask.canvas.getContext("2d")!;
    undoStackRef.current.push(ctx.getImageData(0, 0, mask.canvas.width, mask.canvas.height));
    if (undoStackRef.current.length > 30) undoStackRef.current.shift();
  }

  function handleUndo() {
    const mask = maskRef.current;
    const snapshot = undoStackRef.current.pop();
    if (!mask || !snapshot) return;
    const ctx = mask.canvas.getContext("2d")!;
    ctx.putImageData(snapshot, 0, 0);
    redraw();
  }

  function handleClearMask() {
    pushUndoSnapshot();
    maskRef.current?.clear();
    autoSelectPointsRef.current = [];
    setAutoSelectStatus("idle");
    redraw();
  }

  function pointerToCanvas(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = displayCanvasRef.current!;
    return screenToCanvasPoint(canvas, e.clientX, e.clientY);
  }

  /** Auto Select (SAM 2) — sends the exact same base canvas image the rest
   * of the masking pipeline already uses, plus the accumulated click
   * points for this session (Add/Subtract), to the local segmentation
   * service, then replaces the mask with its result via
   * MaskBuffer.applyExternalMask. Never throws outward: every failure
   * shows a toast and leaves the existing mask/manual tools untouched. */
  async function runAutoSelectClick(point: { x: number; y: number }) {
    const mask = maskRef.current;
    const base = baseCanvasRef.current;
    if (!mask || !base || autoSelectStatus === "running") return;

    const label: 0 | 1 = autoSelectMode === "add" ? 1 : 0;
    const nextPoints = [...autoSelectPointsRef.current, { x: Math.round(point.x), y: Math.round(point.y), label }];
    autoSelectPointsRef.current = nextPoints;
    setAutoSelectStatus("running");

    try {
      const imageBlob = await canvasToBlob(base);
      const result = await autoSelectMaskAction(imageBlob, nextPoints);

      // If the image/mask was swapped out (e.g. a different history
      // version selected) while this request was in flight, discard the
      // now-irrelevant result instead of applying it to the wrong canvas.
      if (maskRef.current !== mask) return;

      if (!result.success) {
        toast.error(result.error);
        autoSelectPointsRef.current = autoSelectPointsRef.current.slice(0, -1);
        setAutoSelectStatus("error");
        return;
      }

      const maskImg = await loadImage(result.data.maskDataUrl);
      if (maskRef.current !== mask) return;

      pushUndoSnapshot();
      mask.applyExternalMask(maskImg);
      redraw();
      setAutoSelectStatus("ready");
    } catch {
      toast.error("Auto Select couldn't generate a selection. You can continue with Brush, Rectangle or Polygon.");
      autoSelectPointsRef.current = autoSelectPointsRef.current.slice(0, -1);
      setAutoSelectStatus("error");
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!maskRef.current) return;
    const p = pointerToCanvas(e);

    if (tool === "move") {
      moveStartRef.current = p;
      return;
    }
    if (tool === "auto-select") {
      void runAutoSelectClick(p);
      return;
    }
    if (tool === "polygon") {
      const first = polygonPointsRef.current[0];
      if (first && Math.hypot(p.x - first.x, p.y - first.y) < 12 && polygonPointsRef.current.length > 2) {
        pushUndoSnapshot();
        maskRef.current.fillPolygon(polygonPointsRef.current, false);
        polygonPointsRef.current = [];
        redraw();
      } else {
        polygonPointsRef.current.push(p);
        redraw();
      }
      return;
    }

    pushUndoSnapshot();
    drawingRef.current = true;
    lastPointRef.current = p;

    if (tool === "rectangle") {
      lastPointRef.current = p; // start corner
      return;
    }

    maskRef.current.strokeDab(p.x, p.y, brushSize / 2, tool === "eraser");
    redraw();
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!maskRef.current) return;
    const p = pointerToCanvas(e);

    if (tool === "move" && moveStartRef.current && onPatternOffsetChange && preview && preview.kind !== "colorize") {
      const dx = p.x - moveStartRef.current.x;
      const dy = p.y - moveStartRef.current.y;
      onPatternOffsetChange(preview.offsetX + dx, preview.offsetY + dy);
      moveStartRef.current = p;
      return;
    }

    if (!drawingRef.current) return;

    if (tool === "brush" || tool === "eraser") {
      const last = lastPointRef.current;
      if (last) maskRef.current.strokeLine(last.x, last.y, p.x, p.y, brushSize / 2, tool === "eraser");
      lastPointRef.current = p;
      redraw();
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (tool === "rectangle" && drawingRef.current && lastPointRef.current && maskRef.current) {
      const start = lastPointRef.current;
      const end = pointerToCanvas(e);
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      maskRef.current.fillRect(x, y, Math.abs(end.x - start.x), Math.abs(end.y - start.y), false);
      redraw();
    }
    drawingRef.current = false;
    lastPointRef.current = null;
    moveStartRef.current = null;
  }

  useImperativeHandle(ref, () => ({
    async getImageBlob() {
      if (!baseCanvasRef.current) throw new Error("Image not loaded yet.");
      return canvasToBlob(baseCanvasRef.current);
    },
    async getMaskBlob() {
      if (!maskRef.current) throw new Error("Nothing to mask yet.");
      return maskRef.current.toMaskBlob();
    },
    isMaskEmpty() {
      return maskRef.current ? !maskRef.current.hasSelection() : true;
    },
    clearMask() {
      handleClearMask();
    },
    getDimensions() {
      return dimensions;
    },
    getFittedLogoScalePercent(requestedScalePercent: number, logoNaturalWidth: number, logoNaturalHeight: number) {
      if (!maskRef.current) return requestedScalePercent;
      return fitLogoScalePercent(requestedScalePercent, dimensions.width, dimensions.height, maskRef.current.boundingBox(), logoNaturalWidth, logoNaturalHeight);
    },
    async compositeWithAiResult(aiResultDataUrl: string) {
      if (!baseCanvasRef.current || !maskRef.current) throw new Error("Image not loaded yet.");
      return compositeMaskedEdit(baseCanvasRef.current, maskRef.current, aiResultDataUrl);
    },
  }));

  const showMoveTool = preview && preview.kind !== "colorize";

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-center py-3 shrink-0">
        <div className="w-14 h-14 rounded-lg border-2 border-primary overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbnailUrl} alt="Current version" className="w-full h-full object-cover" />
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center px-6 overflow-hidden">
        {loaded && dimensions.width > 0 ? (
          <canvas
            ref={displayCanvasRef}
            width={dimensions.width}
            height={dimensions.height}
            className={cn(
              "max-w-full max-h-full object-contain rounded-lg border border-border shadow-sm bg-muted",
              tool === "move" ? "cursor-move" : tool === "eraser" ? "cursor-cell" : "cursor-crosshair"
            )}
            style={{ touchAction: "none" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        ) : (
          <div className="text-sm text-muted-foreground">Loading image…</div>
        )}
      </div>

      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border shrink-0 flex-wrap">
        <ToolButton icon={Pencil} active={tool === "brush"} label="Brush" onClick={() => setTool("brush")} />
        <ToolButton icon={Eraser} active={tool === "eraser"} label="Eraser" onClick={() => setTool("eraser")} />
        <ToolButton icon={Square} active={tool === "rectangle"} label="Rectangle select" onClick={() => setTool("rectangle")} />
        <ToolButton icon={PenTool} active={tool === "polygon"} label="Polygon select" onClick={() => setTool("polygon")} />
        <ToolButton icon={Wand2} active={tool === "auto-select"} label="Auto Select" onClick={() => setTool("auto-select")} />
        {showMoveTool && <ToolButton icon={Move} active={tool === "move"} label="Move pattern" onClick={() => setTool("move")} />}

        {(tool === "brush" || tool === "eraser") && (
          <div className="flex items-center gap-2 ml-1">
            <span className="text-xs text-muted-foreground">Size:</span>
            <input
              type="range"
              min={8}
              max={120}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-28 accent-primary"
              aria-label="Brush size"
            />
          </div>
        )}

        {tool === "auto-select" && (
          <div className="flex items-center gap-2 ml-1">
            <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
              <button
                type="button"
                onClick={() => setAutoSelectMode("add")}
                aria-pressed={autoSelectMode === "add"}
                className={cn(
                  "px-2 py-1 rounded-md text-xs font-medium transition-colors",
                  autoSelectMode === "add" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setAutoSelectMode("subtract")}
                aria-pressed={autoSelectMode === "subtract"}
                className={cn(
                  "px-2 py-1 rounded-md text-xs font-medium transition-colors",
                  autoSelectMode === "subtract" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Subtract
              </button>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {autoSelectStatus === "running"
                ? "Generating selection…"
                : autoSelectStatus === "ready"
                  ? "Selection ready — refine if needed"
                  : autoSelectStatus === "error"
                    ? "Auto Select couldn't select that area — try another spot or use Brush/Rectangle/Polygon"
                    : "Click a garment area to automatically select it (AI estimate — refine with Brush/Eraser if needed)"}
            </span>
          </div>
        )}

        <div className="flex-1" />

        <button type="button" onClick={handleUndo} aria-label="Undo" className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground">
          <Undo2 className="w-4 h-4" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<button type="button" aria-label="More" className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground" />}>
            <MoreHorizontal className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleClearMask}>
              <Trash2 className="w-4 h-4" /> Clear selection
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});

function ToolButton({ icon: Icon, active, label, onClick }: { icon: typeof Pencil; active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex items-center justify-center w-8 h-8 rounded-lg border transition-colors",
        active ? "border-primary bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
