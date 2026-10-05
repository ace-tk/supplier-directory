// Pattern pieces: Size + Piece tags, the auto-tag helper's rules, and the
// maths for "apply to all sizes" and mirrored pairs. Pure functions on plain
// numbers (no Paper.js), so they are easy to unit-test.

import type { Box } from "./clip-fit";
import type { Affine, RepeatSettings } from "./repeat";

/** Stored on a pattern outline. */
export interface PieceTag {
  /** S, M, L, XL, XXL, XXXL or anything custom. */
  size: string;
  /** Front, Back, Waistband, Gusset… */
  piece: string;
  /** Left/Right pair: the name of the piece (in the same size) this one is the mirror image of. */
  mirrorOf?: string;
  /** A reference point placed by the user (e.g. on the centre-front line), measured from the top-left of the outline's box, inches. */
  ref?: { dx: number; dy: number };
}

export const STANDARD_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "4XL", "5XL"];

/** Reads a size from a label: "S", "xl", " XXL ", "2XL" (= XXL), "3XL" (= XXXL). Null if the text is not a size label. */
export function parseSizeLabel(text: string): string | null {
  const t = text.trim().toUpperCase().replace(/\s+/g, "");
  if (t === "2XL") return "XXL";
  if (t === "3XL") return "XXXL";
  return STANDARD_SIZES.includes(t) ? t : null;
}

/** Order for lists: standard sizes smallest first, then custom ones alphabetically. */
export function sizeOrder(size: string): number {
  const i = STANDARD_SIZES.indexOf(size.toUpperCase());
  return i >= 0 ? i : 1000;
}

/**
 * Suggests piece names for the outlines of ONE size block, from their shape
 * and left-to-right position. Only a suggestion — the user confirms it.
 *   tall (height ≥ 1.8 × width)  → Front, Back (left to right); a lone one is "Leg"
 *   wide (width ≥ 1.8 × height)  → Waistband
 *   anything else                → Gusset
 * A wide piece much narrower than the widest one (under 60 %) is a small
 * part such as a gusset, not a second waistband — in the larger sizes a
 * gusset is often wide enough to pass the 1.8 test.
 * Repeated names get a number.
 */
export function namePieces(boxes: Box[]): string[] {
  const kind = boxes.map((b) => (b.h >= 1.8 * b.w ? "tall" : b.w >= 1.8 * b.h ? "wide" : "other"));
  const widest = Math.max(0, ...boxes.filter((_, i) => kind[i] === "wide").map((b) => b.w));
  boxes.forEach((b, i) => {
    if (kind[i] === "wide" && b.w < 0.6 * widest) kind[i] = "other";
  });
  const names = new Array<string>(boxes.length);
  const byX = (k: string) => boxes.map((b, i) => ({ b, i })).filter((e) => kind[e.i] === k).sort((p, q) => p.b.x - q.b.x || p.b.y - q.b.y);
  const tall = byX("tall");
  if (tall.length === 1) names[tall[0].i] = "Leg";
  else if (tall.length === 2) {
    names[tall[0].i] = "Front";
    names[tall[1].i] = "Back";
  } else tall.forEach((e, n) => (names[e.i] = `Leg ${n + 1}`));
  const wide = byX("wide");
  wide.forEach((e, n) => (names[e.i] = wide.length === 1 ? "Waistband" : `Waistband ${n + 1}`));
  const other = byX("other");
  other.forEach((e, n) => (names[e.i] = other.length === 1 ? "Gusset" : `Gusset ${n + 1}`));
  return names;
}

export type ScaleMode = "keep" | "scale";
export type AnchorMode = "center" | "top" | "ref";

export const ANCHOR_LABEL: Record<AnchorMode, string> = { center: "Piece centre", top: "Top-centre (waist)", ref: "Reference point" };

export interface ApplyOptions {
  /** keep = the print keeps its size (right for repeats / all-over prints). scale = the print grows with the piece (placement prints). */
  mode: ScaleMode;
  anchor: AnchorMode;
  /** Keep the copies linked to the master, so later edits follow. */
  link: boolean;
  /** Also put a mirrored copy on each piece marked as the mirror of this one. */
  pairs: boolean;
}

export const DEFAULT_APPLY: ApplyOptions = { mode: "keep", anchor: "center", link: false, pairs: true };

/** The point on a piece that prints are lined up at. */
export function pieceAnchor(box: Box, mode: AnchorMode, tag?: PieceTag | null): { x: number; y: number } {
  if (mode === "ref" && tag?.ref) return { x: box.x + tag.ref.dx, y: box.y + tag.ref.dy };
  if (mode === "top") return { x: box.x + box.w / 2, y: box.y };
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

/**
 * "Scale with piece": one factor for both directions (so the print is never
 * distorted), from the pieces' areas — a piece twice as wide and the same
 * height gets a print √2 larger.
 */
export function sizeScale(master: Box, target: Box): number {
  const m = master.w * master.h;
  const t = target.w * target.h;
  return m > 0 && t > 0 ? Math.sqrt(t / m) : 1;
}

/**
 * Where a print goes on another piece: maps page coordinates on the master
 * piece to page coordinates on the target piece. The master's anchor lands on
 * the target's anchor; `scale` is 1 for "keep print size"; `mirror` flips
 * left-right about the anchor (for a Left / Right pair).
 */
export function sizeTransform(masterAnchor: { x: number; y: number }, targetAnchor: { x: number; y: number }, scale: number, mirror: boolean): Affine {
  const a = scale * (mirror ? -1 : 1);
  return [a, 0, 0, scale, targetAnchor.x - a * masterAnchor.x, targetAnchor.y - scale * masterAnchor.y];
}

/** The repeat settings for a copy: bigger with the piece when scaled; turned and shifted the other way when mirrored. */
export function repeatForCopy(r: RepeatSettings, scale: number, mirror: boolean): RepeatSettings {
  return { ...r, scale: r.scale * scale, rotation: mirror ? -r.rotation : r.rotation, offsetX: (mirror ? -r.offsetX : r.offsetX) * scale, offsetY: r.offsetY * scale };
}

/** "M-Front" */
export const pieceLabel = (tag: PieceTag) => `${tag.size}-${tag.piece}`;
