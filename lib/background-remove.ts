// Background removal for extracted graphics. Pure (works on a raw RGBA buffer,
// no image library) so it can be tested with small synthetic images.
//
// The AI is asked for a flat graphic on a plain background; this removes that
// background for real: it finds the border colour, then clears only the pixels
// connected to the edge that are close to it. Same-coloured areas INSIDE the
// graphic (a white petal on a white background) are left alone.

export interface RemoveBackgroundOptions {
  /** How far a pixel's colour may be from the background colour and still count as background (0-255, per channel). */
  tolerance?: number;
  /** Softens the cut edge so the graphic does not keep a hard halo. */
  feather?: boolean;
}

export interface RemoveBackgroundResult {
  /** Share of pixels that are transparent afterwards (0-1). */
  transparent: number;
  /** False when the border was not a plain colour, so nothing was cut. */
  removed: boolean;
}

const DEFAULT_TOLERANCE = 28;

/** Share of pixels that are already (nearly) transparent. */
export function transparentShare(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): number {
  const n = width * height;
  if (!n) return 0;
  let t = 0;
  for (let i = 0; i < n; i++) if (rgba[i * 4 + 3] < 16) t++;
  return t / n;
}

const dist = (rgba: ArrayLike<number>, i: number, r: number, g: number, b: number) => Math.max(Math.abs(rgba[i] - r), Math.abs(rgba[i + 1] - g), Math.abs(rgba[i + 2] - b));

/** The most common border colour, and how much of the border it covers. */
function borderColour(rgba: ArrayLike<number>, w: number, h: number, tol: number): { r: number; g: number; b: number; cover: number } {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  const add = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (rgba[i + 3] < 16) return;
    const key = ((rgba[i] >> 4) << 8) | ((rgba[i + 1] >> 4) << 4) | (rgba[i + 2] >> 4);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += rgba[i];
    e.g += rgba[i + 1];
    e.b += rgba[i + 2];
    buckets.set(key, e);
  };
  for (let x = 0; x < w; x++) {
    add(x, 0);
    add(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    add(0, y);
    add(w - 1, y);
  }
  let best: { n: number; r: number; g: number; b: number } | undefined;
  for (const e of buckets.values()) if (!best || e.n > best.n) best = e;
  // A border that is already fully transparent is background as it stands.
  if (!best) return { r: 255, g: 255, b: 255, cover: 1 };
  const r = best.r / best.n;
  const g = best.g / best.n;
  const b = best.b / best.n;
  let near = 0;
  let total = 0;
  const check = (x: number, y: number) => {
    total++;
    const i = (y * w + x) * 4;
    if (rgba[i + 3] < 16 || dist(rgba, i, r, g, b) <= tol) near++;
  };
  for (let x = 0; x < w; x++) {
    check(x, 0);
    check(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    check(0, y);
    check(w - 1, y);
  }
  return { r, g, b, cover: total ? near / total : 0 };
}

/**
 * Clears the plain background of an RGBA image in place. Works only when most
 * of the border is one colour; otherwise it leaves the image untouched.
 */
export function removeBackground(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, options: RemoveBackgroundOptions = {}): RemoveBackgroundResult {
  const tol = options.tolerance ?? DEFAULT_TOLERANCE;
  const n = width * height;
  if (!n) return { transparent: 0, removed: false };
  const bg = borderColour(rgba, width, height, tol);
  if (bg.cover < 0.85) return { transparent: transparentShare(rgba, width, height), removed: false };

  const isBg = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const seed = (x: number, y: number) => {
    const p = y * width + x;
    if (isBg[p]) return;
    const i = p * 4;
    if (rgba[i + 3] < 16 || dist(rgba, i, bg.r, bg.g, bg.b) <= tol) {
      isBg[p] = 1;
      queue[tail++] = p;
    }
  };
  for (let x = 0; x < width; x++) {
    seed(x, 0);
    seed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    seed(0, y);
    seed(width - 1, y);
  }
  while (head < tail) {
    const p = queue[head++];
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) seed(x - 1, y);
    if (x < width - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < height - 1) seed(x, y + 1);
  }

  let cleared = 0;
  for (let p = 0; p < n; p++) {
    if (isBg[p]) {
      rgba[p * 4 + 3] = 0;
      cleared++;
    }
  }

  if (options.feather !== false) {
    // Pixels touching the cleared area become partly transparent in proportion
    // to how close they are to the background colour, so no white fringe remains.
    for (let p = 0; p < n; p++) {
      if (isBg[p]) continue;
      const x = p % width;
      const y = (p - x) / width;
      const touches = (x > 0 && isBg[p - 1]) || (x < width - 1 && isBg[p + 1]) || (y > 0 && isBg[p - width]) || (y < height - 1 && isBg[p + width]);
      if (!touches) continue;
      const i = p * 4;
      const d = dist(rgba, i, bg.r, bg.g, bg.b);
      const a = Math.min(1, d / (tol * 3));
      rgba[i + 3] = Math.round(rgba[i + 3] * a);
      if (rgba[i + 3] < 16) cleared++;
    }
  }
  return { transparent: cleared / n, removed: true };
}
