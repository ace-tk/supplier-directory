// The editable vector PDF. Server only (pdf-lib).
//
// Same picture as the TIFF, but nothing is flattened:
//   - outlines, cut lines and vector prints stay vector paths
//   - a PowerClip is a real clipping path around its print (q … W n … Q)
//   - each original image is embedded ONCE (its own bytes when it is an sRGB JPEG or PNG)
//   - a repeat's tile is ONE form XObject, drawn once per tile position
//   - three layers (optional content groups): Print, Cut lines, Size labels
// The page is the export area at exact size: 1 in = 72 pt.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  appendBezierCurve,
  beginText,
  clip,
  clipEvenOdd,
  closePath,
  concatTransformationMatrix,
  drawObject,
  endPath,
  endText,
  lineTo,
  moveText,
  moveTo,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFOperator,
  PDFOperatorNames as Op,
  PDFString,
  popGraphicsState,
  pushGraphicsState,
  setDashPattern,
  setFillingRgbColor,
  setFontAndSize,
  setGraphicsState,
  setLineCap,
  setLineJoin,
  setLineWidth,
  setStrokingRgbColor,
  showText,
  StandardFonts,
  type PDFFont,
  type PDFRef,
} from "pdf-lib";
import { parse as parseFont, type Font } from "opentype.js";
import sharp from "sharp";
import type { Pt } from "../../engine/bleed";
import { outlineWeight } from "../../engine/fonts";
import { cellMatrix, coverInRepeatSpace, repeatCells } from "../../engine/repeat";
import type { CompoundNode, PathNode, SceneNode, StyleJSON, TextNode } from "../../engine/serialize";
import { PDF_IMAGE_DPI } from "../options";
import { bleedClip, bleedFor, hasFill, imageNeeds, isConvertedLabel } from "../scene";
import { ExportError, type RenderInput } from "./render";

export interface PdfResult {
  file: string;
  bytes: number;
  widthPt: number;
  heightPt: number;
  /** Distinct images embedded, and how many times images are drawn in total. */
  images: number;
  imageDraws: number;
  /** Repeat tiles: definitions (form XObjects) and placements. */
  tileDefs: number;
  tiles: number;
  /** Clipping paths written (one per printed piece). */
  clips: number;
  layers: string[];
  /** Images that were made smaller by the downsample option: name, from → to pixels wide. */
  downsampled: { name: string; from: number; to: number }[];
  liveText: number;
  outlinedText: number;
  warnings: string[];
}

export const PDF_LAYERS = ["Print", "Cut lines", "Size labels"] as const;
/** Inches. */
const PDF_TILE_OVERLAP = 0.003;
type Layer = (typeof PDF_LAYERS)[number];

/** "#rrggbb", "#rgb", "rgb(…)" or "rgba(…)" → 0–1 components. */
export function parseColor(css: string | null | undefined): { r: number; g: number; b: number; a: number } | null {
  if (!css || css === "none") return null;
  const s = css.trim();
  let m = /^#([0-9a-f]{3,8})$/i.exec(s);
  if (m) {
    const h = m[1].length <= 4 ? [...m[1]].map((c) => c + c).join("") : m[1];
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
    return { r: n(0), g: n(2), b: n(4), a: h.length >= 8 ? n(6) : 1 };
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (p.length >= 3 && p.every(Number.isFinite)) return { r: p[0] / 255, g: p[1] / 255, b: p[2] / 255, a: p[3] ?? 1 };
  }
  return null;
}

const fonts = new Map<number, Promise<Font>>();
function outlineFont(weight: 400 | 700): Promise<Font> {
  let p = fonts.get(weight);
  if (!p) {
    p = readFile(path.join(process.cwd(), "public", "pattern-print-studio", "fonts", `arimo-latin-${weight}-normal.woff`)).then((b) => parseFont(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer));
    p.catch(() => fonts.delete(weight));
    fonts.set(weight, p);
  }
  return p;
}

interface Embedded {
  ref: PDFRef;
}

/**
 * An original, ready for the PDF. An sRGB (or untagged) JPEG or PNG that
 * needs no change is embedded byte for byte. Anything else is converted
 * first: other colour profiles and CMYK become sRGB, EXIF-rotated photos are
 * turned upright, other formats become PNG — and, when asked, images with
 * more pixels than `maxWidth` are made smaller.
 */
async function embedImage(pdf: PDFDocument, file: string, name: string, maxWidth: number | null, downsampled: PdfResult["downsampled"]): Promise<Embedded> {
  try {
    const bytes = await readFile(file);
    const meta = await sharp(bytes, { limitInputPixels: false }).metadata();
    const width = meta.autoOrient?.width ?? meta.width ?? 0;
    const srgb = !meta.icc || meta.icc.includes("sRGB", 0, "latin1");
    const upright = !meta.orientation || meta.orientation === 1;
    const shrink = maxWidth !== null && maxWidth > 0 && width > maxWidth;
    const asIs = (meta.format === "jpeg" || meta.format === "png") && srgb && upright && !shrink && meta.space !== "cmyk" && (meta.format !== "png" || (meta.depth === "uchar" && !meta.isProgressive));
    if (asIs) return { ref: (meta.format === "jpeg" ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes)).ref };
    let img = sharp(bytes, { limitInputPixels: false }).autoOrient().toColourspace("srgb");
    if (shrink) {
      img = img.resize({ width: maxWidth as number, kernel: "lanczos3" });
      downsampled.push({ name, from: width, to: maxWidth as number });
    }
    // Photographs stay JPEG (high quality); everything else is lossless PNG.
    if (meta.format === "jpeg" && !meta.hasAlpha) return { ref: (await pdf.embedJpg(await img.jpeg({ quality: 95, chromaSubsampling: "4:4:4" }).toBuffer())).ref };
    return { ref: (await pdf.embedPng(await img.png({ compressionLevel: 6 }).toBuffer())).ref };
  } catch (err) {
    throw new ExportError(`The original image "${name}" could not be read (${err instanceof Error ? err.message : "unknown error"}). Import it again and retry.`);
  }
}

/** An operator pdf-lib has no helper for. Numbers must be wrapped as PDF numbers. */
const op = (name: Op, args: (PDFName | number)[] = []) => PDFOperator.of(name, args.map((a) => (typeof a === "number" ? PDFNumber.of(a) : a)));

/** Writes the export as an editable PDF. */
export async function renderPdf(input: RenderInput, file: string, opts: { onProgress?: (step: "preparing" | "rendering" | "saving", fraction: number) => void; signal?: AbortSignal } = {}): Promise<PdfResult> {
  const { doc, area, options } = input;
  const stop = () => {
    if (opts.signal?.aborted) throw new ExportError("The export was cancelled.");
  };
  const pdf = await PDFDocument.create();
  pdf.setTitle(doc.name);
  pdf.setCreator("SupplyBase Pattern Print Studio");
  pdf.setProducer("SupplyBase Pattern Print Studio (pdf-lib)");
  const widthPt = area.w * 72;
  const heightPt = area.h * 72;
  const page = pdf.addPage([widthPt, heightPt]);
  const ctx = pdf.context;
  const warnings: string[] = [];
  const result: PdfResult = { file, bytes: 0, widthPt, heightPt, images: 0, imageDraws: 0, tileDefs: 0, tiles: 0, clips: 0, layers: [...PDF_LAYERS], downsampled: [], liveText: 0, outlinedText: 0, warnings };

  // ---------------------------------------------------------------- images: each original once
  opts.onProgress?.("preparing", 0);
  const needs = imageNeeds(doc, PDF_IMAGE_DPI);
  const images = new Map<string, Embedded>();
  let done = 0;
  for (const [id, need] of needs) {
    stop();
    const source = input.originalPath(id);
    const name = input.assetName?.(id) ?? id;
    if (!source) throw new ExportError(`The original image "${name}" is missing. Import it again and retry.`);
    images.set(id, await embedImage(pdf, source, name, options.pdfDownsample ? need : null, result.downsampled));
    opts.onProgress?.("preparing", ++done / needs.size);
  }
  result.images = images.size;

  // ---------------------------------------------------------------- resources
  /** A place operators are written to: the page itself, or a repeat tile's own form XObject (with its own resources). */
  interface Target {
    ops: PDFOperator[];
    xobjects: Map<string, PDFRef>;
    gstates: Map<number, string>;
    gstateRefs: Map<string, PDFRef>;
    fontNames: Map<PDFFont, string>;
    isPage: boolean;
  }
  const newTarget = (isPage: boolean): Target => ({ ops: [], xobjects: new Map(), gstates: new Map(), gstateRefs: new Map(), fontNames: new Map(), isPage });
  let nameCount = 0;
  const xobjectName = (t: Target, ref: PDFRef, prefix: string): PDFName => {
    for (const [n, r] of t.xobjects) if (r === ref) return PDFName.of(n);
    const n = `${prefix}${++nameCount}`;
    t.xobjects.set(n, ref);
    return PDFName.of(n);
  };
  const alphaState = (t: Target, alpha: number): PDFName => {
    const key = Math.round(alpha * 1000);
    let n = t.gstates.get(key);
    if (!n) {
      n = `GS${key}`;
      t.gstates.set(key, n);
      t.gstateRefs.set(n, ctx.register(ctx.obj({ Type: "ExtGState", ca: alpha, CA: alpha })));
    }
    return PDFName.of(n);
  };
  const helvetica = options.pdfLiveText ? { 400: await pdf.embedFont(StandardFonts.Helvetica), 700: await pdf.embedFont(StandardFonts.HelveticaBold) } : null;
  const fontName = (t: Target, f: PDFFont): PDFName => {
    let n = t.fontNames.get(f);
    if (!n) {
      n = `F${t.fontNames.size + 1}${t.isPage ? "" : "t"}`;
      t.fontNames.set(f, n);
    }
    return PDFName.of(n);
  };

  // ---------------------------------------------------------------- drawing helpers (inches, y down — the page matrix converts)
  const lineWidth = Math.max(0.01, options.cutLineWidthPt) / 72;
  const lineColor = parseColor(doc.settings.cutLines?.color) ?? { r: 0, g: 0, b: 0, a: 1 };

  const tracePath = (t: Target, n: PathNode) => {
    const segs = n.segs;
    if (!segs.length) return;
    t.ops.push(moveTo(segs[0][0], segs[0][1]));
    const count = n.closed ? segs.length : segs.length - 1;
    for (let i = 0; i < count; i++) {
      const a = segs[i];
      const b = segs[(i + 1) % segs.length];
      if (a[4] === 0 && a[5] === 0 && b[2] === 0 && b[3] === 0) t.ops.push(lineTo(b[0], b[1]));
      else t.ops.push(appendBezierCurve(a[0] + a[4], a[1] + a[5], b[0] + b[2], b[1] + b[3], b[0], b[1]));
    }
    if (n.closed) t.ops.push(closePath());
  };
  const traceOutline = (t: Target, n: PathNode | CompoundNode) => {
    for (const p of n.t === "path" ? [n] : n.children) tracePath(t, p);
  };
  const tracePolygons = (t: Target, polys: Pt[][]) => {
    for (const pts of polys) {
      t.ops.push(moveTo(pts[0].x, pts[0].y));
      for (let i = 1; i < pts.length; i++) t.ops.push(lineTo(pts[i].x, pts[i].y));
      t.ops.push(closePath());
    }
  };
  /** Sets fill / stroke state and returns the painting operator for a style, or null if it paints nothing. */
  const paint = (t: Target, s: StyleJSON | undefined, override?: { stroke: { r: number; g: number; b: number }; width: number; dash?: number[] }): PDFOperator | null => {
    const fillC = override ? null : parseColor(s?.fill);
    const strokeC = override ? { ...override.stroke, a: 1 } : parseColor(s?.stroke);
    const width = override ? override.width : (s?.strokeWidth ?? 0);
    const doStroke = !!strokeC && width > 0;
    if (!fillC && !doStroke) return null;
    const alpha = (s?.opacity ?? 1) * Math.min(fillC?.a ?? 1, strokeC?.a ?? 1);
    if (alpha < 0.999) t.ops.push(setGraphicsState(alphaState(t, alpha)));
    if (fillC) t.ops.push(setFillingRgbColor(fillC.r, fillC.g, fillC.b));
    if (doStroke && strokeC) {
      t.ops.push(setStrokingRgbColor(strokeC.r, strokeC.g, strokeC.b), setLineWidth(width));
      const dash = override ? override.dash : s?.dash;
      if (dash?.length) t.ops.push(setDashPattern(dash, 0));
      if (s?.cap) t.ops.push(setLineCap(s.cap === "round" ? 1 : s.cap === "square" ? 2 : 0));
      if (override || s?.join) t.ops.push(setLineJoin(override || s?.join === "round" ? 1 : s?.join === "bevel" ? 2 : 0));
    }
    const evenOdd = s?.fillRule === "evenodd";
    if (fillC && doStroke) return op(evenOdd ? Op.FillEvenOddAndStroke : Op.FillNonZeroAndStroke);
    if (fillC) return op(evenOdd ? Op.FillEvenOdd : Op.FillNonZero);
    return op(Op.StrokePath);
  };
  const shape = (t: Target, n: PathNode | CompoundNode, style = n.style, override?: Parameters<typeof paint>[2]) => {
    t.ops.push(pushGraphicsState());
    const painter = paint(t, style, override);
    if (painter) {
      traceOutline(t, n);
      t.ops.push(painter);
    }
    t.ops.push(popGraphicsState());
  };
  const image = (t: Target, n: Extract<SceneNode, { t: "raster" }>) => {
    const img = images.get(n.assetId);
    if (!img) return void warnings.push(`An image is missing its original file (${n.name || n.assetId}) and was left out.`);
    const m = n.matrix;
    // The image fills the unit square (y up); the raster's own box is centred on its origin (y down).
    t.ops.push(pushGraphicsState(), concatTransformationMatrix(m[0], m[1], m[2], m[3], m[4], m[5]), concatTransformationMatrix(n.width, 0, 0, -n.height, -n.width / 2, n.height / 2), drawObject(xobjectName(t, img.ref, "Im")), popGraphicsState());
    result.imageDraws++;
  };
  const text = async (t: Target, n: TextNode) => {
    const m = n.matrix;
    const fill = parseColor(n.style?.fill) ?? { r: 0, g: 0, b: 0, a: 1 };
    const lines = n.content.split(/\r\n|\n|\r/);
    const weight = outlineWeight(n.fontWeight);
    const font = helvetica?.[weight];
    // Live text needs every character to exist in the standard encoding; otherwise this text is outlined.
    const encodable = !!font && lines.every((line) => {
      try {
        font.encodeText(line);
        return true;
      } catch {
        return false;
      }
    });
    t.ops.push(pushGraphicsState(), concatTransformationMatrix(m[0], m[1], m[2], m[3], m[4], m[5]), setFillingRgbColor(fill.r, fill.g, fill.b));
    if (font && encodable) {
      // Text space is y up: flip it back inside the text's own (y down) coordinates.
      t.ops.push(concatTransformationMatrix(1, 0, 0, -1, 0, 0), beginText(), setFontAndSize(fontName(t, font), n.fontSize));
      let x = 0;
      let y = 0;
      lines.forEach((line, i) => {
        const w = font.widthOfTextAtSize(line, n.fontSize);
        const x0 = n.justification === "center" ? -w / 2 : n.justification === "right" ? -w : 0;
        const y0 = -i * n.fontSize * 1.2;
        t.ops.push(moveText(x0 - x, y0 - y), showText(font.encodeText(line)));
        x = x0;
        y = y0;
      });
      t.ops.push(endText());
      result.liveText++;
    } else {
      try {
        const f = await outlineFont(weight);
        lines.forEach((line, i) => {
          const w = f.getAdvanceWidth(line, n.fontSize);
          const x0 = n.justification === "center" ? -w / 2 : n.justification === "right" ? -w : 0;
          let px = 0;
          let py = 0;
          for (const c of f.getPath(line, x0, i * n.fontSize * 1.2, n.fontSize).commands) {
            if (c.type === "M") t.ops.push(moveTo(c.x!, c.y!));
            else if (c.type === "L") t.ops.push(lineTo(c.x!, c.y!));
            else if (c.type === "C") t.ops.push(appendBezierCurve(c.x1!, c.y1!, c.x2!, c.y2!, c.x!, c.y!));
            // PDF has no quadratic curve: the same curve as a cubic.
            else if (c.type === "Q") t.ops.push(appendBezierCurve(px + (2 / 3) * (c.x1! - px), py + (2 / 3) * (c.y1! - py), c.x! + (2 / 3) * (c.x1! - c.x!), c.y! + (2 / 3) * (c.y1! - c.y!), c.x!, c.y!));
            else t.ops.push(closePath());
            if (c.type !== "Z") {
              px = c.x!;
              py = c.y!;
            }
          }
        });
        t.ops.push(op(Op.FillNonZero));
        result.outlinedText++;
      } catch {
        warnings.push(`Text "${n.content.slice(0, 40)}" could not be turned into outlines and was left out.`);
      }
    }
    t.ops.push(popGraphicsState());
  };

  /** Everything inside a print, exactly as designed. */
  const artwork = async (t: Target, n: SceneNode) => {
    if (n.hidden) return;
    switch (n.t) {
      case "path":
      case "compound":
        shape(t, n);
        break;
      case "group":
        if (n.clipped && n.children.length) {
          const [mask, ...rest] = n.children;
          t.ops.push(pushGraphicsState());
          if (mask.t === "path" || mask.t === "compound") {
            traceOutline(t, mask);
            t.ops.push(mask.style?.fillRule === "evenodd" ? clipEvenOdd() : clip(), endPath());
          }
          for (const c of rest) await artwork(t, c);
          t.ops.push(popGraphicsState());
        } else for (const c of n.children) await artwork(t, c);
        break;
      case "text":
        await text(t, n);
        break;
      case "raster":
        image(t, n);
        break;
      case "powerclip":
        await piece(t, n);
        break;
    }
  };

  const layerOps: Record<Layer, Target> = { Print: newTarget(true), "Cut lines": newTarget(true), "Size labels": newTarget(true) };
  const forms: { stream: ReturnType<typeof ctx.formXObject>; target: Target }[] = [];
  const cutLine = (n: PathNode | CompoundNode, own: boolean) => {
    const c = own ? parseColor(n.style?.stroke) ?? lineColor : lineColor;
    shape(layerOps["Cut lines"], n, n.style, { stroke: c, width: lineWidth, dash: n.style?.dash });
  };

  const piece = async (t: Target, n: Extract<SceneNode, { t: "powerclip" }>) => {
    if (n.contents.length) {
      const bleed = bleedClip(n.frame, bleedFor(n.pc, doc.settings));
      // The PowerClip: a real clipping path, then the print inside it.
      t.ops.push(pushGraphicsState());
      if (bleed.polygons) {
        tracePolygons(t, bleed.polygons);
        t.ops.push(clipEvenOdd(), endPath());
      } else {
        traceOutline(t, n.frame);
        t.ops.push(n.frame.style?.fillRule === "evenodd" ? clipEvenOdd() : clip(), endPath());
      }
      result.clips++;
      if (n.pc.repeat && n.tile) {
        const tile = { x: n.tile[0], y: n.tile[1], w: n.tile[2], h: n.tile[3] };
        // The tile's artwork goes into ONE form XObject…
        const form = newTarget(false);
        for (const c of n.contents) await artwork(form, c);
        const pad = Math.max(tile.w, tile.h) * 0.5;
        const stream = ctx.formXObject(form.ops, { BBox: ctx.obj([tile.x - pad, tile.y - pad, tile.x + tile.w + pad, tile.y + tile.h + pad]) });
        const ref = ctx.register(stream);
        forms.push({ stream, target: form });
        result.tileDefs++;
        const name = xobjectName(t, ref, "Tile");
        // …which is then only referenced, once per tile position.
        const seamless = n.pc.repeat.gapX <= 0 && n.pc.repeat.gapY <= 0;
        const cover = coverInRepeatSpace(n.pc.repeat, tile, bleed.box);
        for (const cell of repeatCells(n.pc.repeat, { x: tile.x, y: tile.y }, cover)) {
          // Touching tiles overlap by 0.003 in (under 0.1 mm), which hides most of the hairlines PDF viewers draw between them.
          const m = cellMatrix(n.pc.repeat, tile, cell, seamless ? PDF_TILE_OVERLAP : 0);
          t.ops.push(pushGraphicsState(), concatTransformationMatrix(m[0], m[1], m[2], m[3], m[4], m[5]), drawObject(name), popGraphicsState());
          result.tiles++;
        }
      } else for (const c of n.contents) await artwork(t, c);
      t.ops.push(popGraphicsState());
    }
    cutLine(n.frame, false);
  };

  /** Objects on the page itself: sorted into the three layers (same rules as the TIFF scene). */
  const top = async (n: SceneNode) => {
    if (n.hidden) return;
    switch (n.t) {
      case "powerclip":
        await piece(layerOps.Print, n);
        break;
      case "group":
        if (n.clipped) await artwork(layerOps.Print, n);
        else for (const c of n.children) await top(c);
        break;
      case "text":
        await text(layerOps["Size labels"], n);
        break;
      case "raster":
        image(layerOps.Print, n);
        break;
      case "path":
      case "compound":
        if (isConvertedLabel(n)) shape(layerOps["Size labels"], n);
        else if (n.tag) cutLine(n, false);
        else if (hasFill(n)) await artwork(layerOps.Print, n);
        else cutLine(n, true);
        break;
    }
  };
  opts.onProgress?.("rendering", 0);
  for (const [i, n] of doc.objects.entries()) {
    stop();
    await top(n);
    opts.onProgress?.("rendering", (i + 1) / doc.objects.length);
  }

  // ---------------------------------------------------------------- layers (optional content groups)
  // A PDF always carries all three layers; the export options decide which are switched on when it is opened.
  const visible: Record<Layer, boolean> = { Print: true, "Cut lines": options.cutLines, "Size labels": options.sizeLabels };
  const ocg = Object.fromEntries(PDF_LAYERS.map((name) => [name, ctx.register(ctx.obj({ Type: "OCG", Name: pdfString(name) }))])) as Record<Layer, PDFRef>;
  pdf.catalog.set(
    PDFName.of("OCProperties"),
    ctx.obj({
      OCGs: PDF_LAYERS.map((n) => ocg[n]),
      D: { Name: pdfString("Layers"), Order: PDF_LAYERS.map((n) => ocg[n]), ON: PDF_LAYERS.filter((n) => visible[n]).map((n) => ocg[n]), OFF: PDF_LAYERS.filter((n) => !visible[n]).map((n) => ocg[n]) },
    })
  );
  const layerKey: Record<Layer, string> = { Print: "LPrint", "Cut lines": "LCut", "Size labels": "LLabels" };

  // ---------------------------------------------------------------- the page: inches, y down → points, y up (and the mirror)
  const all: PDFOperator[] = [pushGraphicsState()];
  if (options.background === "white") all.push(setFillingRgbColor(1, 1, 1), op(Op.AppendRectangle, [0, 0, widthPt, heightPt]), op(Op.FillNonZero));
  all.push(concatTransformationMatrix(72, 0, 0, -72, -area.x * 72, (area.y + area.h) * 72));
  if (options.mirror) all.push(concatTransformationMatrix(-1, 0, 0, 1, 2 * area.x + area.w, 0));
  const pageTarget = newTarget(true);
  for (const name of PDF_LAYERS) {
    const t = layerOps[name];
    all.push(op(Op.BeginMarkedContentSequence, [PDFName.of("OC"), PDFName.of(layerKey[name])]), ...t.ops, op(Op.EndMarkedContent));
    for (const [n, r] of t.xobjects) pageTarget.xobjects.set(n, r);
    for (const [n, r] of t.gstateRefs) pageTarget.gstateRefs.set(n, r);
    for (const [f, n] of t.fontNames) pageTarget.fontNames.set(f, n);
  }
  all.push(popGraphicsState());

  const resources = (t: Target) => {
    const r: Record<string, unknown> = {};
    if (t.xobjects.size) r.XObject = Object.fromEntries(t.xobjects);
    if (t.gstateRefs.size) r.ExtGState = Object.fromEntries(t.gstateRefs);
    if (t.fontNames.size) r.Font = Object.fromEntries([...t.fontNames].map(([f, n]) => [n, f.ref]));
    return r;
  };
  for (const f of forms) f.stream.dict.set(PDFName.of("Resources"), ctx.obj(resources(f.target) as never));
  page.node.set(PDFName.of("Resources"), ctx.obj({ ...resources(pageTarget), Properties: Object.fromEntries(PDF_LAYERS.map((n) => [layerKey[n], ocg[n]])) } as never));
  // Written in chunks: a long sheet has hundreds of thousands of operators.
  for (let i = 0; i < all.length; i += 20000) page.pushOperators(...all.slice(i, i + 20000));

  stop();
  opts.onProgress?.("saving", 0);
  const bytes = await pdf.save({ useObjectStreams: false });
  await writeFile(file, bytes);
  result.bytes = bytes.length;
  return result;
}

/** A PDF text string (layer names). */
function pdfString(value: string) {
  return PDFString.of(value);
}
