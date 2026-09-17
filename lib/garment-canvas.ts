// AI Garment Studio — canvas utilities. Everything here is deterministic,
// client-side, and real: coordinate mapping (screen → canvas → source-image
// space), mask painting/export, and a genuine non-AI "live preview" for
// Patterns/Prints-Logos/Colorize using real luminance-based Canvas 2D
// compositing (multiply-blend a pattern/color under the garment's own
// shading), so slider movements never trigger a network call.
//
// Coordinate design: the canvas element's pixel BUFFER is set to the
// source image's own (capped) natural resolution — canvas space and
// source-image space are therefore the same coordinate system by
// construction. The only real transform needed is screen → canvas, done
// via the canvas's live getBoundingClientRect(), which already reflects
// any CSS scale/zoom/pan/resize applied to it, so it stays correct across
// all of those without separately tracking zoom math.

export const MAX_CANVAS_DIMENSION = 1536;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't read the image."));
    img.src = src;
  });
}

/** Bounded, non-destructive resize — caps the longer edge for memory
 * safety, never crops or distorts the aspect ratio (garments are usually
 * portrait product photos; unlike Repeat Print Maker, there's no reason
 * to force a square). */
export async function loadBoundedImage(src: string): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const img = await loadImage(src);
  const scale = Math.min(1, MAX_CANVAS_DIMENSION / Math.max(img.width, img.height));
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't supported in this browser.");
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, width, height };
}

export function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png");
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Couldn't encode the image."));
    }, "image/png");
  });
}

/** Screen (client) coordinates → canvas-buffer coordinates, which are the
 * same as source-image pixel coordinates by construction (see file doc).
 * Uses the canvas's live rendered box, so this stays correct through any
 * CSS scale/zoom/pan/resize without tracking that math separately. */
export function screenToCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

export type MaskTool = "brush" | "eraser" | "rectangle" | "polygon" | "move" | "auto-select";

/** The real mask buffer, maintained separately from what's drawn on
 * screen: opaque black = preserved (OpenAI's edit-mask convention),
 * transparent = editable. Painting uses destination-out to punch real
 * transparency; erasing paints opaque black back in. */
export class MaskBuffer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(width: number, height: number) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas isn't supported in this browser.");
    this.ctx = ctx;
    this.clear();
  }

  clear() {
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** True once at least one pixel has been painted transparent (selected). */
  hasSelection(): boolean {
    const { data } = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
    return false;
  }

  /** Tight bounding box of the currently selected (transparent-in-mask)
   * pixels, in this mask's own pixel coordinates — or null if nothing is
   * selected. Used to keep a single Prints/Logos placement from being
   * requested/rendered larger than the area the user actually painted
   * (see fitLogoScalePercent), instead of letting an oversized placement
   * get abruptly clipped by the mask at edit time. */
  boundingBox(): { x: number; y: number; width: number; height: number } | null {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const { data } = this.ctx.getImageData(0, 0, w, h);
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
      const rowOffset = y * w;
      for (let x = 0; x < w; x++) {
        if (data[(rowOffset + x) * 4 + 3] < 255) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX) return null;
    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }

  strokeDab(x: number, y: number, radius: number, erase: boolean) {
    this.ctx.globalCompositeOperation = erase ? "source-over" : "destination-out";
    this.ctx.fillStyle = "black";
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  strokeLine(x1: number, y1: number, x2: number, y2: number, radius: number, erase: boolean) {
    this.ctx.globalCompositeOperation = erase ? "source-over" : "destination-out";
    this.ctx.strokeStyle = "black";
    this.ctx.lineWidth = radius * 2;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  fillRect(x: number, y: number, w: number, h: number, erase: boolean) {
    this.ctx.globalCompositeOperation = erase ? "source-over" : "destination-out";
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(x, y, w, h);
  }

  fillPolygon(points: { x: number; y: number }[], erase: boolean) {
    if (points.length < 3) return;
    this.ctx.globalCompositeOperation = erase ? "source-over" : "destination-out";
    this.ctx.fillStyle = "black";
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) this.ctx.lineTo(p.x, p.y);
    this.ctx.closePath();
    this.ctx.fill();
  }

  /** A colored, semi-transparent overlay for on-screen display — the mask
   * PNG sent to the AI is opaque/transparent (see toMaskBlob), which
   * wouldn't itself be visible as a helpful selection highlight. */
  drawOverlay(target: CanvasRenderingContext2D, color = "rgba(99, 102, 241, 0.45)") {
    const { data } = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const overlay = document.createElement("canvas");
    overlay.width = this.canvas.width;
    overlay.height = this.canvas.height;
    const octx = overlay.getContext("2d")!;
    const img = octx.createImageData(this.canvas.width, this.canvas.height);
    const [r, g, b, a] = parseRgba(color);
    for (let i = 0; i < data.length; i += 4) {
      const selected = data[i + 3] < 255; // transparent in the mask = selected
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = selected ? a : 0;
    }
    octx.putImageData(img, 0, 0);
    target.drawImage(overlay, 0, 0);
  }

  toMaskBlob(): Promise<Blob> {
    return canvasToBlob(this.canvas);
  }

  /** Same selection as selectionAlpha, but with a blurred boundary — used
   * only to soften the seam where AI-edited pixels meet preserved
   * original pixels in the final composite (see compositeMaskedEdit). The
   * blur radius is intentionally small and resolution-relative: the deep
   * interior of both the selected and preserved regions stays fully
   * opaque/transparent, so a large unmasked region is never partially
   * blended with AI output — only the immediate boundary is feathered. */
  selectionAlphaFeathered(featherPx: number): HTMLCanvasElement {
    const hard = this.selectionAlpha();
    if (featherPx <= 0) return hard;
    const out = document.createElement("canvas");
    out.width = hard.width;
    out.height = hard.height;
    const ctx = out.getContext("2d")!;
    ctx.filter = `blur(${featherPx}px)`;
    ctx.drawImage(hard, 0, 0);
    return out;
  }

  /** An alpha-only canvas: opaque exactly where the mask is selected
   * (transparent in the real mask), transparent elsewhere — used as a
   * destination-in clip so a preview layer only shows through the
   * selected region. */
  private selectionAlpha(): HTMLCanvasElement {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const { data } = this.ctx.getImageData(0, 0, w, h);
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const octx = out.getContext("2d")!;
    const img = octx.createImageData(w, h);
    for (let i = 0; i < data.length; i += 4) {
      const selected = data[i + 3] < 255;
      img.data[i + 3] = selected ? 255 : 0;
    }
    octx.putImageData(img, 0, 0);
    return out;
  }

  /** Clips `target`'s current content down to only the selected region —
   * everything outside the mask becomes transparent in `target`. */
  drawMaskedOnly(target: CanvasRenderingContext2D, width: number, height: number) {
    const sel = this.selectionAlpha();
    target.globalCompositeOperation = "destination-in";
    target.drawImage(sel, 0, 0, width, height);
    target.globalCompositeOperation = "source-over";
  }

  /** Replaces the current selection with an externally-computed mask — used
   * by Auto Select (SAM 2) to feed its result into this exact same
   * MaskBuffer representation, so every downstream consumer (getMaskBlob,
   * compositeMaskedEdit, the existing overlay, Brush/Eraser refinement)
   * needs zero changes and can't tell the difference from a hand-painted
   * selection. `maskImage` is treated as grayscale: bright pixels (>127)
   * become selected (transparent, per this class's own convention),
   * everything else becomes preserved (opaque black) — matching the plain
   * white-on-black mask services/segmentation/server.py returns.
   *
   * `maskImage` must already be exactly this buffer's own pixel
   * dimensions — guaranteed by construction, since Auto Select always
   * sends this exact canvas's own image for inference (see
   * services/garment-segmentation.ts). A real mismatch throws rather than
   * silently misaligning the selection. */
  applyExternalMask(maskImage: HTMLImageElement) {
    if (maskImage.naturalWidth !== this.canvas.width || maskImage.naturalHeight !== this.canvas.height) {
      throw new Error("Auto Select returned a selection that doesn't match the image size.");
    }

    const src = document.createElement("canvas");
    src.width = this.canvas.width;
    src.height = this.canvas.height;
    const sctx = src.getContext("2d")!;
    sctx.drawImage(maskImage, 0, 0);
    const { data: maskData } = sctx.getImageData(0, 0, src.width, src.height);

    this.clear();
    const selection = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    for (let i = 0; i < maskData.length; i += 4) {
      const selected = maskData[i] > 127;
      selection.data[i + 3] = selected ? 0 : 255;
    }
    this.ctx.putImageData(selection, 0, 0);
  }
}

function parseRgba(css: string): [number, number, number, number] {
  const m = /rgba?\(([^)]+)\)/.exec(css);
  const parts = (m?.[1] ?? "0,0,0,1").split(",").map((s) => parseFloat(s));
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, Math.round((parts[3] ?? 1) * 255)];
}

export interface PatternPreviewParams {
  scalePercent: number; // 100 = pattern's natural tile size relative to canvas
  rotationDeg: number;
  brightnessPercent: number; // 50 = neutral, matches the reference slider's 50% default
  offsetX?: number;
  offsetY?: number;
}

/** Prints/Logos — unlike Patterns (an intentionally infinite, repeating
 * tile), a single print/logo placement should never be requested/rendered
 * larger than the area the user actually masked: an oversized request gets
 * abruptly clipped at the mask boundary once composited (see
 * compositeMaskedEdit), which is what "artwork extends outside the
 * garment" turned out to be in practice — the mask, not the photo
 * background, is the printable-area boundary. This caps `requestedScalePercent`
 * (same tileSize convention as renderPatternPreview: 100% = the shorter
 * canvas dimension) so the logo's own aspect-preserved footprint fits
 * within the mask's bounding box, auto-shrinking oversized requests instead
 * of letting them get clipped. Returns the input unchanged if there's no
 * selection yet to fit against. */
export function fitLogoScalePercent(
  requestedScalePercent: number,
  canvasWidth: number,
  canvasHeight: number,
  bbox: { width: number; height: number } | null,
  logoNaturalWidth: number,
  logoNaturalHeight: number
): number {
  if (!bbox || logoNaturalWidth <= 0 || logoNaturalHeight <= 0) return requestedScalePercent;
  const logoAspect = logoNaturalWidth / logoNaturalHeight;
  const maxTileWidth = Math.min(bbox.width, bbox.height * logoAspect);
  const maxScalePercent = (maxTileWidth / Math.min(canvasWidth, canvasHeight)) * 100;
  return Math.min(requestedScalePercent, Math.max(maxScalePercent, 0));
}

/** Real, non-AI "apply pattern to masked region" preview: tiles the
 * pattern image at the given scale/rotation, then multiply-blends the
 * garment's own luminance (its real folds/shadows/highlights) back over
 * it, clipped to the mask — so the preview looks fold-aware instead of a
 * flat rectangle pasted on top. No network call, purely Canvas 2D. */
function grayscaleLayer(source: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  const layer = document.createElement("canvas");
  layer.width = width;
  layer.height = height;
  const ctx = layer.getContext("2d")!;
  ctx.filter = "grayscale(1)";
  ctx.drawImage(source, 0, 0, width, height);
  return layer;
}

/** Draws `content` onto a fresh canvas with a CSS filter applied — filters
 * apply to the drawImage call itself, so this must never be the same
 * canvas as `content` (drawing a canvas onto its own context is
 * unreliable/a no-op in most browsers). */
function withFilter(content: HTMLCanvasElement, filter: string, width: number, height: number): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d")!;
  ctx.filter = filter;
  ctx.drawImage(content, 0, 0);
  return out;
}

export function renderPatternPreview(
  target: CanvasRenderingContext2D,
  width: number,
  height: number,
  sourceImage: HTMLCanvasElement,
  mask: MaskBuffer,
  patternImage: HTMLImageElement,
  params: PatternPreviewParams
) {
  const { scalePercent, rotationDeg, brightnessPercent, offsetX = 0, offsetY = 0 } = params;

  const tiled = document.createElement("canvas");
  tiled.width = width;
  tiled.height = height;
  const tctx = tiled.getContext("2d")!;
  const tileSize = Math.max(24, (Math.min(width, height) * scalePercent) / 100);
  const patternFill = tctx.createPattern(patternImage, "repeat");
  if (patternFill) {
    tctx.save();
    tctx.translate(width / 2 + offsetX, height / 2 + offsetY);
    tctx.rotate((rotationDeg * Math.PI) / 180);
    tctx.scale(tileSize / patternImage.width, tileSize / patternImage.width);
    tctx.fillStyle = patternFill;
    const span = (Math.max(width, height) * patternImage.width) / tileSize;
    tctx.fillRect(-span, -span, span * 2, span * 2);
    tctx.restore();
  }

  // Fold-aware: multiply the garment's own luminance back over the flat
  // tiled pattern, so shadows/highlights show through the new pattern.
  const foldAware = document.createElement("canvas");
  foldAware.width = width;
  foldAware.height = height;
  const fctx = foldAware.getContext("2d")!;
  fctx.drawImage(tiled, 0, 0);
  fctx.globalCompositeOperation = "multiply";
  fctx.drawImage(grayscaleLayer(sourceImage, width, height), 0, 0);
  fctx.globalCompositeOperation = "source-over";

  const brightnessAdjust = brightnessPercent / 50; // 50% slider = neutral (1.0)
  const final = withFilter(foldAware, `brightness(${brightnessAdjust})`, width, height);
  const finalCtx = final.getContext("2d")!;
  mask.drawMaskedOnly(finalCtx, width, height);

  target.save();
  target.drawImage(sourceImage, 0, 0, width, height);
  target.drawImage(final, 0, 0);
  target.restore();
}

/** THE structural preservation guarantee for every masked AI edit tool
 * (Change/Regenerate/Remove/Patterns/Prints-Logos/Colorize — all six route
 * through this). The AI's own response is never trusted to have left
 * unmasked pixels untouched, no matter what the prompt asked for or how
 * the model actually behaved: this deterministically rebuilds the final
 * image as `mask ? aiResult : original` at the source image's own pixel
 * grid, with a small feather only at the mask boundary. A pixel more than
 * a few px from the boundary is either exactly the original (untouched by
 * this function) or exactly the AI's pixel — there is no path through this
 * code where AI content can appear outside the mask.
 *
 * The AI's returned image is very often a different resolution/aspect
 * ratio than the source (OpenAI's edit endpoint only accepts a few fixed
 * square/portrait/landscape sizes) — it's resampled onto the exact
 * original canvas grid first so every subsequent pixel operation is
 * aligned to the same coordinate space as the mask.
 *
 * Returns a Blob, not a data URL string — a multi-megabyte base64 string
 * passed as a plain Server Action argument hits a real Next.js/React
 * Flight serialization limit ("Maximum array nesting exceeded", confirmed
 * by testing this exact function), the same constraint documented on
 * EditImageParams in lib/ai/openai-client.ts and PreparedTile in
 * lib/repeat-print-canvas.ts. Blob/File use a different, binary-safe
 * transport path that Server Actions support natively. */
export async function compositeMaskedEdit(originalCanvas: HTMLCanvasElement, mask: MaskBuffer, aiResultDataUrl: string, featherPx?: number): Promise<Blob> {
  const width = originalCanvas.width;
  const height = originalCanvas.height;
  const feather = featherPx ?? Math.max(2, Math.round(Math.min(width, height) / 300));

  const aiImg = await loadImage(aiResultDataUrl);
  const aiLayer = document.createElement("canvas");
  aiLayer.width = width;
  aiLayer.height = height;
  const aiCtx = aiLayer.getContext("2d")!;
  aiCtx.drawImage(aiImg, 0, 0, width, height);

  // Clip the AI layer down to (a feathered version of) the user's mask —
  // everywhere outside it, this layer becomes fully transparent.
  aiCtx.globalCompositeOperation = "destination-in";
  aiCtx.drawImage(mask.selectionAlphaFeathered(feather), 0, 0);
  aiCtx.globalCompositeOperation = "source-over";

  const result = document.createElement("canvas");
  result.width = width;
  result.height = height;
  const rctx = result.getContext("2d")!;
  rctx.drawImage(originalCanvas, 0, 0); // base: exact original pixels, everywhere
  rctx.drawImage(aiLayer, 0, 0); // only the (feathered) masked region can override them

  return canvasToBlob(result);
}

export interface ColorizePreviewParams {
  colorHex: string;
  brightnessPercent: number;
}

/** Real, non-AI "recolor masked region" preview: fills the region with
 * the chosen color, then multiply-blends the garment's own luminance back
 * over it — a standard photoreal colorize technique (folds/shadows stay
 * visible because they're literally the source image's own shading). */
export function renderColorizePreview(
  target: CanvasRenderingContext2D,
  width: number,
  height: number,
  sourceImage: HTMLCanvasElement,
  mask: MaskBuffer,
  params: ColorizePreviewParams
) {
  const { colorHex, brightnessPercent } = params;

  const colorLayer = document.createElement("canvas");
  colorLayer.width = width;
  colorLayer.height = height;
  const cctx = colorLayer.getContext("2d")!;
  cctx.fillStyle = colorHex;
  cctx.fillRect(0, 0, width, height);
  cctx.globalCompositeOperation = "multiply";
  cctx.drawImage(grayscaleLayer(sourceImage, width, height), 0, 0);
  cctx.globalCompositeOperation = "source-over";

  const brightnessAdjust = brightnessPercent / 50;
  const final = withFilter(colorLayer, `brightness(${brightnessAdjust})`, width, height);
  const finalCtx = final.getContext("2d")!;
  mask.drawMaskedOnly(finalCtx, width, height);

  target.save();
  target.drawImage(sourceImage, 0, 0, width, height);
  target.drawImage(final, 0, 0);
  target.restore();
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

// Quick Color Swap tuning — kept in one place rather than scattered magic
// numbers. TOLERANCE: pixels within this RGB distance of the picked thread
// color are fully swapped. FALLOFF: an additional band beyond that where the
// swap blends in proportionally instead of a hard cutoff, so anti-aliased
// edges between this thread color and its neighbors stay smooth instead of
// getting a visible seam.
const SWAP_TOLERANCE = 42;
const SWAP_FALLOFF = 24;

export interface ThreadColorSwapResult {
  dataUrl: string;
  /** False when no pixel was close enough to `fromHex` to change — the
   * caller should report "color not found" and leave everything else as-is. */
  matched: boolean;
}

/**
 * Print → Embroidery "Quick Color Swap" — a real, deterministic, non-AI
 * recolor of the already-generated embroidery preview image. Only pixels
 * close to `fromHex` are touched (a color-distance threshold, softened by
 * SWAP_FALLOFF so anti-aliased edges blend rather than getting a hard seam);
 * every other color, the artwork's shape, and the design's transparency are
 * left completely untouched. Each matched pixel keeps its own lightness
 * relative to `fromHex` (the AI-rendered thread shading/texture at that
 * pixel) and re-applies it to `toHex`, instead of flatly overwriting it —
 * same idea as this file's other real Canvas 2D recolor (renderColorizePreview),
 * applied per-pixel instead of as a full-layer blend since only one thread
 * color, not the whole image, should change.
 */
export async function swapThreadColor(imageDataUrl: string, fromHex: string, toHex: string): Promise<ThreadColorSwapResult> {
  const img = await loadImage(imageDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't supported in this browser.");
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const [fr, fg, fb] = hexToRgb(fromHex);
  const [tr, tg, tb] = hexToRgb(toHex);

  let matched = false;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue; // fully transparent pixel — never touched

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const dist = Math.sqrt((r - fr) ** 2 + (g - fg) ** 2 + (b - fb) ** 2);
    if (dist >= SWAP_TOLERANCE + SWAP_FALLOFF) continue;

    const weight = dist <= SWAP_TOLERANCE ? 1 : 1 - (dist - SWAP_TOLERANCE) / SWAP_FALLOFF;
    matched = true;

    const delta = (r - fr + (g - fg) + (b - fb)) / 3;
    const nr = clamp255(tr + delta);
    const ng = clamp255(tg + delta);
    const nb = clamp255(tb + delta);

    data[i] = Math.round(r + (nr - r) * weight);
    data[i + 1] = Math.round(g + (ng - g) * weight);
    data[i + 2] = Math.round(b + (nb - b) * weight);
    // alpha untouched — transparency preserved exactly.
  }

  if (!matched) return { dataUrl: imageDataUrl, matched: false };

  ctx.putImageData(imageData, 0, 0);
  return { dataUrl: canvasToDataUrl(canvas), matched: true };
}
