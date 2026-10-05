// Fitting a print inside a PowerClip frame, and print-quality (DPI) checks.
// Pure maths on plain numbers — no Paper.js — so it is easy to unit-test.

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 0..8 reference point on a box: 0 1 2 / 3 4 5 / 6 7 8 (top-left … bottom-right). */
export function anchorOf(b: Box, ref: number): { x: number; y: number } {
  return { x: b.x + (b.w * (ref % 3)) / 2, y: b.y + (b.h * Math.floor(ref / 3)) / 2 };
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Bounding box size of a w × h rectangle rotated by `deg`. */
export function rotatedSize(w: number, h: number, deg: number): { w: number; h: number } {
  const c = Math.abs(Math.cos(rad(deg)));
  const s = Math.abs(Math.sin(rad(deg)));
  return { w: w * c + h * s, h: w * s + h * c };
}

/** Fit: the largest scale at which the whole (possibly rotated) print is still inside the frame's box. */
export function fitScale(w: number, h: number, deg: number, frameW: number, frameH: number): number {
  const b = rotatedSize(w, h, deg);
  return Math.min(frameW / b.w, frameH / b.h);
}

/**
 * Fill: the smallest scale at which the print, centred on the frame, covers
 * the frame's whole box with no gaps — also when the print is rotated (its
 * corners, not its bounding box, are what must reach past the frame).
 */
export function fillScale(w: number, h: number, deg: number, frameW: number, frameH: number): number {
  const c = Math.abs(Math.cos(rad(deg)));
  const s = Math.abs(Math.sin(rad(deg)));
  return Math.max((frameW * c + frameH * s) / w, (frameW * s + frameH * c) / h);
}

/** Dots per inch of an image printed at this size: the lower of the two directions. */
export function effectiveDpi(pxWidth: number, pxHeight: number, widthIn: number, heightIn: number): number {
  return Math.min(pxWidth / widthIn, pxHeight / heightIn);
}

export const DPI_WARN = 150;
export const DPI_BAD = 100;

/** ok = fine for print; low = may be soft (yellow); bad = will look blurry (red). */
export function dpiLevel(dpi: number): "ok" | "low" | "bad" {
  return dpi < DPI_BAD ? "bad" : dpi < DPI_WARN ? "low" : "ok";
}
