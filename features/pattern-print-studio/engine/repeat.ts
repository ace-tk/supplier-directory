// Repeat fill for a PowerClip: one tile, repeated to cover the frame. Only
// these PARAMETERS are stored; tile positions are worked out when needed.
// Pure maths (no Paper.js), in page inches, so it is easy to unit-test and
// Phase 4's exporter can use exactly the same numbers.

import type { Box } from "./clip-fit";

export type RepeatType = "straight" | "half-drop" | "half-brick" | "mirror";

export const REPEAT_TYPES: { id: RepeatType; label: string; help: string }[] = [
  { id: "straight", label: "Straight (block)", help: "Tiles in a plain grid" },
  { id: "half-drop", label: "Half-drop", help: "Every other column drops by half a tile" },
  { id: "half-brick", label: "Half-brick", help: "Every other row shifts sideways by half a tile" },
  { id: "mirror", label: "Mirror", help: "Alternate tiles are flipped, so edges always meet" },
];

export interface RepeatSettings {
  type: RepeatType;
  /** Size one tile is drawn at, inches (before `scale`). */
  tileW: number;
  tileH: number;
  /** Space between tiles, inches. 0 = seamless; negative = overlap. */
  gapX: number;
  gapY: number;
  /** Where the repeat starts, relative to the tile's own position, inches (in the repeat's own axes). */
  offsetX: number;
  offsetY: number;
  /** Rotation of the whole repeat, degrees counter-clockwise. */
  rotation: number;
  /** Scale of the whole repeat (tile and spacing), percent. */
  scale: number;
}

export function defaultRepeat(tileW: number, tileH: number): RepeatSettings {
  return { type: "straight", tileW, tileH, gapX: 0, gapY: 0, offsetX: 0, offsetY: 0, rotation: 0, scale: 100 };
}

/** One tile of the repeat. x / y: its top-left corner in the repeat's own (un-rotated) axes. */
export interface Cell {
  i: number;
  j: number;
  x: number;
  y: number;
  flipX: boolean;
  flipY: boolean;
}

/** Drawn tile size and the distance from one tile to the next, with `scale` applied. */
export function repeatSteps(r: RepeatSettings): { tw: number; th: number; stepX: number; stepY: number } {
  const k = Math.max(0.0001, r.scale / 100);
  const tw = Math.max(1e-6, r.tileW * k);
  const th = Math.max(1e-6, r.tileH * k);
  // A large negative gap would make tiles pile up for ever: never step by less than a twentieth of a tile.
  return { tw, th, stepX: Math.max(tw / 20, tw + r.gapX * k), stepY: Math.max(th / 20, th + r.gapY * k) };
}

/** Top-left of tile (i, j). Computed from i and j directly — never accumulated — so positions are exact. */
export function cellPosition(r: RepeatSettings, origin: { x: number; y: number }, i: number, j: number): { x: number; y: number } {
  const { stepX, stepY } = repeatSteps(r);
  const odd = (n: number) => Math.abs(n % 2) === 1;
  return {
    x: origin.x + r.offsetX + i * stepX + (r.type === "half-brick" && odd(j) ? stepX / 2 : 0),
    y: origin.y + r.offsetY + j * stepY + (r.type === "half-drop" && odd(i) ? stepY / 2 : 0),
  };
}

/** How many tiles are needed to cover `cover` — used to refuse absurd settings before building anything. */
export function countCells(r: RepeatSettings, cover: Box): number {
  const { stepX, stepY } = repeatSteps(r);
  return (Math.ceil(cover.w / stepX) + 3) * (Math.ceil(cover.h / stepY) + 3);
}

/**
 * Every tile that touches `cover` (a box in the repeat's own, un-rotated
 * axes). `origin` is the top-left of the tile's own bounding box.
 */
export function repeatCells(r: RepeatSettings, origin: { x: number; y: number }, cover: Box): Cell[] {
  const { tw, th, stepX, stepY } = repeatSteps(r);
  const x0 = origin.x + r.offsetX;
  const y0 = origin.y + r.offsetY;
  // One extra column / row each side covers the half-step stagger.
  const i0 = Math.floor((cover.x - x0 - tw) / stepX) - 1;
  const i1 = Math.ceil((cover.x + cover.w - x0) / stepX) + 1;
  const j0 = Math.floor((cover.y - y0 - th) / stepY) - 1;
  const j1 = Math.ceil((cover.y + cover.h - y0) / stepY) + 1;
  const odd = (n: number) => Math.abs(n % 2) === 1;
  const cells: Cell[] = [];
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const p = cellPosition(r, origin, i, j);
      if (p.x + tw < cover.x || p.x > cover.x + cover.w || p.y + th < cover.y || p.y > cover.y + cover.h) continue;
      cells.push({ i, j, x: p.x, y: p.y, flipX: r.type === "mirror" && odd(i), flipY: r.type === "mirror" && odd(j) });
    }
  }
  return cells;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** The point the whole repeat turns about: the centre of the tile at its starting position. */
export function repeatPivot(r: RepeatSettings, tile: Box): { x: number; y: number } {
  return { x: tile.x + tile.w / 2, y: tile.y + tile.h / 2 };
}

/** A page-space box, expressed in the repeat's own axes (bounding box after undoing the rotation). */
export function coverInRepeatSpace(r: RepeatSettings, tile: Box, page: Box): Box {
  if (!r.rotation) return page;
  const p = repeatPivot(r, tile);
  // The repeat is drawn rotated counter-clockwise by `rotation` (y is down, so that is −rotation in canvas terms); undo it.
  const c = Math.cos(rad(r.rotation));
  const s = Math.sin(rad(r.rotation));
  let l = Infinity;
  let t = Infinity;
  let rr = -Infinity;
  let b = -Infinity;
  for (const [x, y] of [[page.x, page.y], [page.x + page.w, page.y], [page.x, page.y + page.h], [page.x + page.w, page.y + page.h]]) {
    const dx = x - p.x;
    const dy = y - p.y;
    const ux = p.x + dx * c - dy * s;
    const uy = p.y + dx * s + dy * c;
    l = Math.min(l, ux);
    rr = Math.max(rr, ux);
    t = Math.min(t, uy);
    b = Math.max(b, uy);
  }
  return { x: l, y: t, w: rr - l, h: b - t };
}

/** A page-space movement expressed in the repeat's own axes (for dragging the repeat's starting point). */
export function deltaInRepeatSpace(r: RepeatSettings, dx: number, dy: number): { x: number; y: number } {
  const c = Math.cos(rad(r.rotation));
  const s = Math.sin(rad(r.rotation));
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}

export type Affine = [number, number, number, number, number, number]; // a b c d tx ty: x' = a·x + c·y + tx, y' = b·x + d·y + ty

const mul = (m: Affine, n: Affine): Affine => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];

/**
 * Matrix that draws the tile artwork (which sits at `tile`, its own box on
 * the page) as cell `cell`: scaled to the tile size, flipped for mirror
 * repeats, moved to the cell, then turned with the whole repeat. `grow`
 * enlarges the tile by that many inches in total about its centre — a
 * sub-pixel overlap that hides hairline seams between touching tiles.
 */
export function cellMatrix(r: RepeatSettings, tile: Box, cell: Cell, grow = 0): Affine {
  const { tw, th } = repeatSteps(r);
  const sx = ((tw + grow) / tile.w) * (cell.flipX ? -1 : 1);
  const sy = ((th + grow) / tile.h) * (cell.flipY ? -1 : 1);
  // Map the tile's centre to the cell's centre; scale (and flip) about it.
  const cx = cell.x + tw / 2;
  const cy = cell.y + th / 2;
  let m: Affine = [sx, 0, 0, sy, cx - sx * (tile.x + tile.w / 2), cy - sy * (tile.y + tile.h / 2)];
  if (r.rotation) {
    const p = repeatPivot(r, tile);
    const c = Math.cos(rad(r.rotation));
    const s = Math.sin(rad(r.rotation));
    // Counter-clockwise on screen (y down).
    const rot: Affine = [c, -s, s, c, p.x - p.x * c - p.y * s, p.y + p.x * s - p.y * c];
    m = mul(rot, m);
  }
  return m;
}

export const applyAffine = (m: Affine, x: number, y: number) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
