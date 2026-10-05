// Bitmap → vector tracing: settings, pre-processing and analysis. Pure
// functions on raw RGBA pixels (no DOM, no Paper.js), shared by the worker
// and the dialog, and easy to unit-test.

export type TraceMode = "bw" | "color";

export interface TraceSettings {
  mode: TraceMode;
  /** Black & white: pixels darker than this (0–255) become black. */
  threshold: number;
  /** Colour mode: number of colours, 2–8. */
  colors: number;
  /** 0–100. Higher = smoother curves, fewer nodes. */
  smoothing: number;
  /** 0–100. Higher = keep smaller specks and details. */
  detail: number;
  /** Leave out the white (background) areas. */
  removeBackground: boolean;
}

export const DEFAULT_TRACE: TraceSettings = { mode: "bw", threshold: 128, colors: 4, smoothing: 40, detail: 60, removeBackground: true };

export type RGBA = [number, number, number, number];

/** One traced shape: a fill colour and closed subpaths (outline first, then holes). */
export interface TraceShape {
  color: RGBA;
  /** Each subpath: start point, then segments ["L", x, y] or ["Q", cx, cy, x, y]. Pixel coordinates of the traced image. */
  subpaths: { start: [number, number]; segs: (["L", number, number] | ["Q", number, number, number, number])[] }[];
}

export interface TraceResult {
  /** Size of the image that was traced, px. Shape coordinates are in this space. */
  width: number;
  height: number;
  shapes: TraceShape[];
  nodes: number;
}

export interface RawImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Black & white line art: every pixel becomes pure black or pure white. Transparent counts as white. */
export function toBinary(image: RawImage, threshold: number): RawImage {
  const src = image.data;
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    const a = src[i + 3] / 255;
    // Composite on white, so see-through pixels are background.
    const l = lum(src[i], src[i + 1], src[i + 2]) * a + 255 * (1 - a);
    const v = l < threshold ? 0 : 255;
    out[i] = out[i + 1] = out[i + 2] = v;
    out[i + 3] = 255;
  }
  return { width: image.width, height: image.height, data: out };
}

/** Flattens transparency onto white (colour mode). */
export function flattenOnWhite(image: RawImage): RawImage {
  const src = image.data;
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    const a = src[i + 3] / 255;
    out[i] = src[i] * a + 255 * (1 - a);
    out[i + 1] = src[i + 1] * a + 255 * (1 - a);
    out[i + 2] = src[i + 2] * a + 255 * (1 - a);
    out[i + 3] = 255;
  }
  return { width: image.width, height: image.height, data: out };
}

/** Colour histogram at 4 bits per channel, most common first. */
function histogram(image: RawImage): { r: number; g: number; b: number; n: number }[] {
  const bins = new Map<number, { r: number; g: number; b: number; n: number }>();
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
    let bin = bins.get(key);
    if (!bin) bins.set(key, (bin = { r: 0, g: 0, b: 0, n: 0 }));
    bin.r += d[i];
    bin.g += d[i + 1];
    bin.b += d[i + 2];
    bin.n++;
  }
  return [...bins.values()].map((b) => ({ r: b.r / b.n, g: b.g / b.n, b: b.b / b.n, n: b.n })).sort((x, y) => y.n - x.n);
}

/**
 * Picks up to `count` clearly different colours, most common first. The
 * same image always gives the same palette, so the preview matches the
 * final trace.
 */
export function pickPalette(image: RawImage, count: number): RGBA[] {
  const picked: RGBA[] = [];
  const bins = histogram(image);
  // Start strict (very different colours only), relax until we have enough.
  for (const minDist of [90, 60, 40, 24, 12]) {
    for (const b of bins) {
      if (picked.length >= count) break;
      if (picked.every((p) => Math.hypot(p[0] - b.r, p[1] - b.g, p[2] - b.b) >= minDist)) picked.push([Math.round(b.r), Math.round(b.g), Math.round(b.b), 255]);
    }
    if (picked.length >= count) break;
  }
  return picked.length ? picked : [[0, 0, 0, 255]];
}

/**
 * True for photographs and gradients, which don't trace well: a logo or
 * line drawing is covered by a handful of colours, a photo needs dozens.
 */
export function looksPhotographic(image: RawImage): boolean {
  const bins = histogram(image);
  const total = image.width * image.height;
  let covered = 0;
  let needed = 0;
  for (const b of bins) {
    covered += b.n;
    needed++;
    if (covered >= total * 0.9) break;
  }
  return needed > 24;
}

export const isNearWhite = (c: RGBA) => c[0] >= 232 && c[1] >= 232 && c[2] >= 232;

/** Slider values → the tracer's own numbers. `scale` = traced size ÷ full size (the preview is smaller). */
export function tracerNumbers(s: TraceSettings, scale: number) {
  const smooth = Math.min(100, Math.max(0, s.smoothing)) / 100;
  const detail = Math.min(100, Math.max(0, s.detail)) / 100;
  return {
    // Allowed error when fitting lines and curves, px: more smoothing = looser fit = fewer nodes.
    fit: 0.4 + smooth * 2.6,
    blurRadius: Math.round(smooth * 4),
    // Outlines with fewer edge points than this are dropped as specks.
    minPath: Math.max(0, Math.round((1 - detail) * 40 * Math.max(0.25, scale))),
  };
}
