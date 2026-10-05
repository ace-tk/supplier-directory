// Document JSON → the export picture, as SVG. This is THE render path: the
// dialog's preview, the TIFF and (later) the PDF all start from this scene,
// so what the preview shows is what gets exported. Pure — no Paper.js, no
// DOM — so it runs in Node on the server and in tests.
//
// What goes into an export:
//   prints      PowerClip contents, clipped to outline + bleed; repeats laid out in full
//   artwork     bitmaps and filled shapes that are not inside a piece
//   cut lines   (option) every piece outline and pattern mark (notches, grain lines), at the chosen width
//   size labels (option) label text, as outlines
// The pattern linework is NOT printed unless "cut lines" is on, and a
// pattern piece's own fill is never printed (a piece is anything tagged, or
// holding a print). An untagged filled shape counts as artwork.

import { offsetOutline, pointInPolygon, type Pt } from "../engine/bleed";
import { cellMatrix, coverInRepeatSpace, repeatCells } from "../engine/repeat";
import { pathData, type CompoundNode, type PathNode, type SceneNode, type Seg, type StyleJSON, type TextNode } from "../engine/serialize";
import type { DocSettings } from "../engine/types";
import { pixelSize, type ExportOptions, type Rect } from "./options";

export interface SceneDoc {
  name: string;
  settings: Pick<DocSettings, "bleed" | "cutLines">;
  objects: SceneNode[];
}

export interface SceneInput {
  doc: SceneDoc;
  area: Rect;
  options: ExportOptions;
  /** The image to draw for an asset (a data: URI of the ORIGINAL, prepared for this export). Null = missing. */
  imageHref: (assetId: string) => string | null;
  /** Outline of a text node as SVG path data in the text's own coordinates (its matrix is applied by the scene). Null = cannot be outlined. */
  textPath: (text: TextNode) => string | null;
}

export interface ExportScene {
  widthPx: number;
  heightPx: number;
  /** Repeat tiles placed. */
  tiles: number;
  warnings: string[];
  /** A standalone SVG of a vertical strip of the picture: `widthPx` wide, starting `x0Px` from the left. */
  svg(x0Px?: number, widthPx?: number): string;
}

const num = (v: number) => {
  const s = v.toFixed(6);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
};
const matrixAttr = (m: number[]) => ` transform="matrix(${m.map(num).join(" ")})"`;

/** Curves are turned into straight pieces this fine (inches) before an outline is grown by its bleed: 0.15 px at 300 DPI. */
const FLATNESS = 0.0005;

/** A closed outline as a polygon. */
export function flattenSegs(segs: Seg[], closed: boolean, tolerance = FLATNESS): Pt[] {
  const out: Pt[] = [];
  const count = closed ? segs.length : segs.length - 1;
  for (let i = 0; i < count; i++) {
    const a = segs[i];
    const b = segs[(i + 1) % segs.length];
    const p0 = { x: a[0], y: a[1] };
    const p3 = { x: b[0], y: b[1] };
    out.push(p0);
    if (a[4] === 0 && a[5] === 0 && b[2] === 0 && b[3] === 0) continue;
    const p1 = { x: a[0] + a[4], y: a[1] + a[5] };
    const p2 = { x: b[0] + b[2], y: b[1] + b[3] };
    // How far the curve can be from its chords: bounded by its second differences.
    const d1 = Math.hypot(p0.x - 2 * p1.x + p2.x, p0.y - 2 * p1.y + p2.y);
    const d2 = Math.hypot(p1.x - 2 * p2.x + p3.x, p1.y - 2 * p2.y + p3.y);
    const n = Math.min(400, Math.max(1, Math.ceil(Math.sqrt((0.75 * Math.max(d1, d2)) / tolerance))));
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const m = 1 - t;
      out.push({ x: m * m * m * p0.x + 3 * m * m * t * p1.x + 3 * m * t * t * p2.x + t * t * t * p3.x, y: m * m * m * p0.y + 3 * m * m * t * p1.y + 3 * m * t * t * p2.y + t * t * t * p3.y });
    }
  }
  if (!closed && segs.length) out.push({ x: segs[segs.length - 1][0], y: segs[segs.length - 1][1] });
  return out;
}

const polyData = (pts: Pt[]) => (pts.length ? `M${pts.map((p) => `${num(p.x)},${num(p.y)}`).join("L")}Z` : "");
const outlineData = (n: PathNode | CompoundNode) => (n.t === "path" ? pathData(n) : n.children.map((c) => pathData(c)).join(""));

/**
 * What a piece's print is clipped to: its outline grown outward by the
 * bleed (holes in the outline shrink by the same amount). The same offset
 * code the editor uses, so the export matches the screen.
 */
export function bleedClip(frame: PathNode | CompoundNode, bleed: number): { d: string; box: Rect } {
  const paths = frame.t === "path" ? [frame] : frame.children;
  if (!(bleed > 0)) return { d: outlineData(frame), box: outlineBox(frame, 0) };
  const contours = paths.filter((p) => p.closed && p.segs.length > 1).map((p) => flattenSegs(p.segs, true));
  let d = "";
  contours.forEach((pts, i) => {
    if (pts.length < 3) return;
    const isHole = contours.filter((other, j) => j !== i && other.length >= 3 && pointInPolygon(pts[0], other)).length % 2 === 1;
    d += polyData(offsetOutline(pts, bleed, { tolerance: FLATNESS, inward: isHole }).points);
  });
  return { d: d || outlineData(frame), box: outlineBox(frame, bleed) };
}

/** Box around an outline's nodes and handles (always contains the outline), grown by `pad`. */
function outlineBox(n: PathNode | CompoundNode, pad: number): Rect {
  let l = Infinity;
  let t = Infinity;
  let r = -Infinity;
  let b = -Infinity;
  for (const p of n.t === "path" ? [n] : n.children) {
    for (const s of p.segs) {
      for (const [x, y] of [[s[0], s[1]], [s[0] + s[2], s[1] + s[3]], [s[0] + s[4], s[1] + s[5]]]) {
        l = Math.min(l, x);
        r = Math.max(r, x);
        t = Math.min(t, y);
        b = Math.max(b, y);
      }
    }
  }
  return { x: l - pad, y: t - pad, w: r - l + 2 * pad, h: b - t + 2 * pad };
}

function styleAttrs(s: StyleJSON | undefined): string {
  if (!s) return ' fill="none"';
  const a: string[] = [`fill="${s.fill ?? "none"}"`];
  if (s.fillRule === "evenodd") a.push('fill-rule="evenodd"');
  if (s.stroke) {
    a.push(`stroke="${s.stroke}"`, `stroke-width="${num(s.strokeWidth ?? 0)}"`);
    if (s.dash?.length) a.push(`stroke-dasharray="${s.dash.map(num).join(" ")}"`);
    if (s.cap) a.push(`stroke-linecap="${s.cap}"`);
    if (s.join) a.push(`stroke-linejoin="${s.join}"`);
    if (s.miter !== undefined) a.push(`stroke-miterlimit="${num(s.miter)}"`);
  }
  if (s.opacity !== undefined) a.push(`opacity="${num(s.opacity)}"`);
  return " " + a.join(" ");
}

/** Label text that was converted to curves in the studio keeps its wording in its name. */
const isConvertedLabel = (n: SceneNode) => /^Text "(.+)"$/.test(n.name ?? "");
const hasFill = (n: SceneNode) => !!n.style?.fill && n.style.fill !== "none";

/** The bleed that applies to a PowerClip: its own, or the document's (shown on screen or not). */
export function bleedFor(pc: { bleed?: number }, settings: SceneDoc["settings"]): number {
  const v = typeof pc.bleed === "number" ? pc.bleed : (settings.bleed?.amount ?? 0);
  return v > 0 ? v : 0;
}

/** Builds the export picture for one area at one resolution. */
export function buildExportScene(input: SceneInput): ExportScene {
  const { doc, area, options } = input;
  const dpi = options.dpi;
  const { width: widthPx, height: heightPx } = pixelSize(area, dpi);
  const warnings: string[] = [];
  const defs: string[] = [];
  const prints: string[] = [];
  const lines: string[] = [];
  const labels: string[] = [];
  let ids = 0;
  let tiles = 0;
  const lineWidth = Math.max(0, options.cutLineWidthPt) / 72;
  const lineColor = doc.settings.cutLines?.color || "#000000";
  // Touching repeat tiles overlap by half an output pixel each way, which hides antialiasing hairlines between them.
  const grow = 1 / dpi;

  const cutLine = (n: PathNode | CompoundNode, own: boolean) => {
    if (!options.cutLines || !(lineWidth > 0)) return;
    const dash = n.style?.dash?.length ? ` stroke-dasharray="${n.style.dash.map(num).join(" ")}"` : "";
    lines.push(`<path d="${outlineData(n)}" fill="none" stroke="${own ? (n.style?.stroke ?? lineColor) : lineColor}" stroke-width="${num(lineWidth)}" stroke-linejoin="round"${dash}/>`);
  };
  const text = (n: TextNode, out: string[]) => {
    const d = input.textPath(n);
    if (d === null) return void warnings.push(`Text "${n.content.slice(0, 40)}" could not be turned into outlines and was left out.`);
    out.push(`<path${matrixAttr(n.matrix)} d="${d}"${styleAttrs({ ...n.style, fill: n.style?.fill ?? "#000000", fillRule: undefined })}/>`);
  };
  const image = (n: Extract<SceneNode, { t: "raster" }>, out: string[]) => {
    const href = input.imageHref(n.assetId);
    if (!href) return void warnings.push(`An image is missing its original file (${n.name || n.assetId}) and was left out.`);
    // Paper rasters are centred on their local origin.
    out.push(`<image${matrixAttr(n.matrix)} x="${num(-n.width / 2)}" y="${num(-n.height / 2)}" width="${num(n.width)}" height="${num(n.height)}" preserveAspectRatio="none" href="${href}"/>`);
  };

  /** Everything inside a print is drawn exactly as designed. */
  const artwork = (n: SceneNode, out: string[]) => {
    if (n.hidden) return;
    switch (n.t) {
      case "path":
      case "compound":
        out.push(`<path d="${outlineData(n)}"${styleAttrs(n.style)}/>`);
        break;
      case "group":
        if (n.clipped && n.children.length) {
          const [mask, ...rest] = n.children;
          const id = `c${++ids}`;
          defs.push(`<clipPath id="${id}"><path d="${mask.t === "path" || mask.t === "compound" ? outlineData(mask) : ""}"/></clipPath>`);
          out.push(`<g clip-path="url(#${id})">`);
          for (const c of rest) artwork(c, out);
          out.push("</g>");
        } else for (const c of n.children) artwork(c, out);
        break;
      case "text":
        text(n, out);
        break;
      case "raster":
        image(n, out);
        break;
      case "powerclip":
        piece(n);
        break;
    }
  };

  const piece = (n: Extract<SceneNode, { t: "powerclip" }>) => {
    if (n.contents.length) {
      const clip = bleedClip(n.frame, bleedFor(n.pc, doc.settings));
      const id = `c${++ids}`;
      defs.push(`<clipPath id="${id}"><path d="${clip.d}" clip-rule="evenodd"/></clipPath>`);
      prints.push(`<g clip-path="url(#${id})">`);
      if (n.pc.repeat && n.tile) {
        const tile = { x: n.tile[0], y: n.tile[1], w: n.tile[2], h: n.tile[3] };
        const tileId = `t${ids}`;
        const art: string[] = [];
        for (const c of n.contents) artwork(c, art);
        defs.push(`<g id="${tileId}">${art.join("")}</g>`);
        const seamless = n.pc.repeat.gapX <= 0 && n.pc.repeat.gapY <= 0;
        const cover = coverInRepeatSpace(n.pc.repeat, tile, clip.box);
        for (const cell of repeatCells(n.pc.repeat, { x: tile.x, y: tile.y }, cover)) {
          prints.push(`<use href="#${tileId}"${matrixAttr(cellMatrix(n.pc.repeat, tile, cell, seamless ? grow : 0))}/>`);
          tiles++;
        }
      } else for (const c of n.contents) artwork(c, prints);
      prints.push("</g>");
    }
    cutLine(n.frame, false);
  };

  /** Objects on the page itself (not inside a print): sorted into prints, pattern linework and labels. */
  const top = (n: SceneNode) => {
    if (n.hidden) return;
    switch (n.t) {
      case "powerclip":
        piece(n);
        break;
      case "group":
        if (n.clipped) artwork(n, prints);
        else for (const c of n.children) top(c);
        break;
      case "text":
        if (options.sizeLabels) text(n, labels);
        break;
      case "raster":
        image(n, prints);
        break;
      case "path":
      case "compound":
        if (isConvertedLabel(n)) {
          if (options.sizeLabels) labels.push(`<path d="${outlineData(n)}"${styleAttrs(n.style)}/>`);
        } else if (n.tag) {
          // A tagged pattern piece with no print: its own fill (pattern files often shade the pieces) is never printed.
          cutLine(n, false);
        } else if (hasFill(n)) artwork(n, prints);
        else cutLine(n, true);
        break;
    }
  };
  for (const n of doc.objects) top(n);

  const inner = `<defs>${defs.join("")}</defs>${prints.join("")}${lines.join("")}${labels.join("")}`;
  const flip = options.mirror ? ` transform="matrix(-1 0 0 1 ${num(2 * area.x + area.w)} 0)"` : "";
  const background = options.background === "white" ? `<rect x="${num(area.x - 1)}" y="${num(area.y - 1)}" width="${num(area.w + 2)}" height="${num(area.h + 2)}" fill="#ffffff"/>` : "";
  return {
    widthPx,
    heightPx,
    tiles,
    warnings,
    svg(x0Px = 0, stripPx = widthPx) {
      // Pixels map to inches through the exact output size, so every strip lines up with its neighbours.
      const sx = area.w / widthPx;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${stripPx}" height="${heightPx}" viewBox="${num(area.x + x0Px * sx)} ${num(area.y)} ${num(stripPx * sx)} ${num(area.h)}" preserveAspectRatio="none">${background}<g${flip}>${inner}</g></svg>`;
    },
  };
}

/**
 * How many pixels wide each original image is needed at for this export
 * (its largest use, at the export DPI). The server resamples the original
 * down to this before drawing, which is both sharper and faster than
 * letting the SVG renderer shrink a huge image.
 */
export function imageNeeds(doc: SceneDoc, dpi: number): Map<string, number> {
  const needs = new Map<string, number>();
  const walk = (n: SceneNode, scale: number) => {
    if (n.hidden) return;
    if (n.t === "raster") {
      const widthIn = Math.hypot(n.matrix[0], n.matrix[1]) * n.width * scale;
      const heightIn = Math.hypot(n.matrix[2], n.matrix[3]) * n.height * scale;
      // The asset's own aspect ratio is not known here; ask for enough pixels for the larger side as a width.
      needs.set(n.assetId, Math.max(needs.get(n.assetId) ?? 0, Math.ceil(Math.max(widthIn, heightIn * (n.width / n.height)) * dpi)));
    } else if (n.t === "group") for (const c of n.children) walk(c, scale);
    else if (n.t === "powerclip") {
      let s = scale;
      if (n.pc.repeat && n.tile) {
        const m = cellMatrix(n.pc.repeat, { x: n.tile[0], y: n.tile[1], w: n.tile[2], h: n.tile[3] }, { x: 0, y: 0, i: 0, j: 0, flipX: false, flipY: false });
        s *= Math.max(Math.hypot(m[0], m[1]), Math.hypot(m[2], m[3]));
      }
      for (const c of n.contents) walk(c, s);
    }
  };
  for (const n of doc.objects) walk(n, 1);
  return needs;
}

/** Asset ids of every image the export draws. */
export function usedAssets(doc: SceneDoc): string[] {
  return [...imageNeeds(doc, 1).keys()];
}
