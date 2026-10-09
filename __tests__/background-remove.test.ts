import { describe, expect, it } from "vitest";
import { removeBackground, transparentShare } from "@/lib/background-remove";

/** Builds a w x h RGBA image filled with `bg`, then paints `paint(x, y)` colours over it. */
function image(w: number, h: number, bg: [number, number, number], paint?: (x: number, y: number) => [number, number, number] | null) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = paint?.(x, y) ?? bg;
      const i = (y * w + x) * 4;
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = 255;
    }
  return d;
}
const alphaAt = (d: Uint8ClampedArray, w: number, x: number, y: number) => d[(y * w + x) * 4 + 3];

describe("removeBackground", () => {
  it("clears a plain white background and keeps the graphic", () => {
    const w = 20;
    const h = 20;
    const d = image(w, h, [255, 255, 255], (x, y) => (x >= 6 && x < 14 && y >= 6 && y < 14 ? [200, 30, 30] : null));
    const r = removeBackground(d, w, h, { feather: false });
    expect(r.removed).toBe(true);
    expect(alphaAt(d, w, 0, 0)).toBe(0);
    expect(alphaAt(d, w, 19, 19)).toBe(0);
    expect(alphaAt(d, w, 10, 10)).toBe(255);
    expect(r.transparent).toBeCloseTo(1 - 64 / 400, 2);
  });

  it("does not cut background-coloured areas that are enclosed by the graphic", () => {
    const w = 20;
    const h = 20;
    // a red ring with a white hole in the middle
    const d = image(w, h, [255, 255, 255], (x, y) => {
      const inOuter = x >= 4 && x < 16 && y >= 4 && y < 16;
      const inHole = x >= 8 && x < 12 && y >= 8 && y < 12;
      return inOuter && !inHole ? [200, 30, 30] : null;
    });
    removeBackground(d, w, h, { feather: false });
    expect(alphaAt(d, w, 0, 0)).toBe(0);
    expect(alphaAt(d, w, 10, 10)).toBe(255); // the hole stays white and opaque
    expect(alphaAt(d, w, 5, 5)).toBe(255);
  });

  it("leaves an image alone when the border is not a plain colour", () => {
    const w = 20;
    const h = 20;
    const d = image(w, h, [255, 255, 255], (x) => [(x * 13) % 256, (x * 29) % 256, (x * 7) % 256]);
    const before = Uint8ClampedArray.from(d);
    const r = removeBackground(d, w, h);
    expect(r.removed).toBe(false);
    expect(Array.from(d)).toEqual(Array.from(before));
  });

  it("works on a non-white plain background and tolerates slight noise", () => {
    const w = 16;
    const h = 16;
    const d = image(w, h, [20, 120, 220], (x, y) => (x >= 5 && x < 11 && y >= 5 && y < 11 ? [250, 220, 0] : [20 + ((x + y) % 5), 120, 220 - ((x * y) % 4)]));
    expect(removeBackground(d, w, h, { feather: false }).removed).toBe(true);
    expect(alphaAt(d, w, 1, 1)).toBe(0);
    expect(alphaAt(d, w, 8, 8)).toBe(255);
  });

  it("softens the cut edge when feathering is on", () => {
    const w = 20;
    const h = 20;
    // a near-white (but not background) fringe around a dark shape
    const d = image(w, h, [255, 255, 255], (x, y) => {
      if (x >= 7 && x < 13 && y >= 7 && y < 13) return [10, 10, 10];
      if (x >= 6 && x < 14 && y >= 6 && y < 14) return [200, 200, 200];
      return null;
    });
    removeBackground(d, w, h);
    const edge = alphaAt(d, w, 6, 10);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(255);
    expect(alphaAt(d, w, 10, 10)).toBe(255);
  });

  it("counts already-transparent pixels as background", () => {
    const w = 10;
    const h = 10;
    const d = new Uint8ClampedArray(w * h * 4); // all transparent black
    expect(transparentShare(d, w, h)).toBe(1);
    d[(5 * w + 5) * 4 + 3] = 255;
    d[(5 * w + 5) * 4] = 200;
    expect(transparentShare(d, w, h)).toBeCloseTo(0.99, 2);
    expect(removeBackground(d, w, h, { feather: false }).removed).toBe(true);
    expect(alphaAt(d, w, 5, 5)).toBe(255);
  });

  it("handles an empty image", () => {
    expect(removeBackground(new Uint8ClampedArray(0), 0, 0)).toEqual({ transparent: 0, removed: false });
  });
});
