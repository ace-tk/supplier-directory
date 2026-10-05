import type paper from "paper/dist/paper-core";
import type { Font } from "opentype.js";

type PaperScope = typeof paper;
type Item = paper.Item;
type PathItem = paper.PathItem;

export type ShapingOp = "weld" | "trim" | "intersect" | "simplify" | "front-minus-back" | "back-minus-front";

export const SHAPING_OPS: { id: ShapingOp; label: string; help: string }[] = [
  { id: "weld", label: "Weld", help: "Joins all selected shapes into one" },
  { id: "trim", label: "Trim", help: "Cuts the other shapes out of the last selected one" },
  { id: "intersect", label: "Intersect", help: "Keeps only the area the last selected shape shares with the others" },
  { id: "simplify", label: "Simplify", help: "Removes the hidden parts of shapes that lie under other shapes" },
  { id: "front-minus-back", label: "Front minus back", help: "Cuts every shape behind out of the front one" },
  { id: "back-minus-front", label: "Back minus front", help: "Cuts every shape in front out of the back one" },
];

export interface ShapingPlan {
  /** New shapes (not inserted), each with the object it takes its place and look from. */
  results: { item: PathItem; target: Item }[];
  /** Objects that did the cutting / were merged in. */
  sources: Item[];
  /** Objects the results replace. */
  targets: Item[];
}

function isPathItem(ps: PaperScope, item: Item): item is PathItem {
  return item instanceof ps.Path || item instanceof ps.CompoundPath;
}

function isClosed(ps: PaperScope, item: PathItem): boolean {
  return item instanceof ps.CompoundPath ? (item.children as paper.Path[]).every((c) => c.closed) : (item as paper.Path).closed;
}

function union(items: PathItem[]): PathItem {
  let u = items[0].clone({ insert: false }) as PathItem;
  for (let i = 1; i < items.length; i++) u = u.unite(items[i], { insert: false }) as PathItem;
  return u;
}

/**
 * Works out a shaping operation without touching the document. `selected`
 * is in selection order: like CorelDRAW, the LAST selected object is the
 * target (it gives the result its fill and outline). Throws an Error with a
 * plain-language message when the operation can't be done.
 */
export function planShaping(ps: PaperScope, selected: Item[], op: ShapingOp): ShapingPlan {
  if (selected.length < 2) throw new Error("Select two or more shapes.");
  const items: PathItem[] = [];
  for (const it of selected) {
    if (it instanceof ps.PointText) throw new Error("Convert the text to curves first (Ctrl+Q).");
    if (it instanceof ps.Group) throw new Error("Ungroup first (Ctrl+U) — shaping works on individual shapes.");
    if (!isPathItem(ps, it)) throw new Error("Shaping works on vector shapes only, not bitmaps.");
    if (!isClosed(ps, it)) throw new Error("One of the shapes is an open outline. Close it first (Shape tool → Check outlines).");
    items.push(it);
  }
  const byDepth = [...items].sort((a, b) => a.index - b.index);
  const opts = { insert: false };
  const empty = (r: PathItem) => r.isEmpty() || Math.abs((r as paper.Path).area) < 1e-12;
  let results: ShapingPlan["results"];
  let sources: Item[];
  let targets: Item[];

  if (op === "simplify") {
    results = [];
    byDepth.forEach((it, i) => {
      const above = byDepth.slice(i + 1);
      const r = above.length ? (it.subtract(union(above), opts) as PathItem) : (it.clone(opts) as PathItem);
      if (!empty(r)) results.push({ item: r, target: it });
    });
    sources = [];
    targets = items;
  } else {
    const target = op === "front-minus-back" ? byDepth[byDepth.length - 1] : op === "back-minus-front" ? byDepth[0] : items[items.length - 1];
    const others = items.filter((i) => i !== target);
    const cutter = union(others);
    const r = (op === "weld" ? target.unite(cutter, opts) : op === "intersect" ? target.intersect(cutter, opts) : target.subtract(cutter, opts)) as PathItem;
    if (empty(r)) throw new Error(op === "intersect" ? "These shapes don't overlap, so there is nothing to keep." : "Nothing would be left — the shape is completely covered.");
    results = [{ item: r, target }];
    sources = others;
    targets = [target];
  }
  if (!results.length) throw new Error("Nothing would be left of these shapes.");
  // A result is a new curve: it keeps the target's look, but not its node types or "shape" mark.
  for (const { item, target } of results) {
    item.data = {};
    item.name = target.name;
    for (const p of item instanceof ps.CompoundPath ? (item.children as paper.Path[]) : [item as paper.Path]) p.data = {};
  }
  return { results, sources, targets };
}

/** Node count of a path or compound path. */
export function nodeCount(ps: PaperScope, item: Item): number {
  if (item instanceof ps.CompoundPath) return (item.children as paper.Path[]).reduce((n, c) => n + c.segments.length, 0);
  return item instanceof ps.Path ? item.segments.length : 0;
}

/**
 * Text → outlines, placed exactly where Paper.js draws the text: each line
 * starts at the text's point, lines are `leading` apart, and justification
 * shifts a line by its advance width.
 */
export function textToOutlines(ps: PaperScope, text: paper.PointText, font: Font): paper.CompoundPath {
  const size = Number(text.fontSize);
  const leading = Number(text.leading) || size * 1.2;
  const cp = new ps.CompoundPath({ insert: false });
  text.content.split(/\r\n|\n|\r/).forEach((line, i) => {
    const width = font.getAdvanceWidth(line, size);
    const x0 = text.justification === "center" ? -width / 2 : text.justification === "right" ? -width : 0;
    for (const c of font.getPath(line, x0, i * leading, size).commands) {
      if (c.type === "M") cp.moveTo(new ps.Point(c.x!, c.y!));
      else if (c.type === "L") cp.lineTo(new ps.Point(c.x!, c.y!));
      else if (c.type === "C") cp.cubicCurveTo(new ps.Point(c.x1!, c.y1!), new ps.Point(c.x2!, c.y2!), new ps.Point(c.x!, c.y!));
      else if (c.type === "Q") cp.quadraticCurveTo(new ps.Point(c.x1!, c.y1!), new ps.Point(c.x!, c.y!));
      else cp.closePath();
    }
  });
  cp.fillColor = text.fillColor;
  cp.strokeColor = text.strokeColor;
  if (text.strokeColor) cp.strokeWidth = text.strokeWidth;
  cp.opacity = text.opacity;
  cp.fillRule = "nonzero";
  cp.transform(text.matrix);
  return cp;
}

/** Characters in `content` the outline font has no glyph for. */
export function missingGlyphs(content: string, font: Font): string[] {
  const out = new Set<string>();
  for (const ch of content) if (ch.trim() && font.charToGlyphIndex(ch) === 0) out.add(ch);
  return [...out];
}
