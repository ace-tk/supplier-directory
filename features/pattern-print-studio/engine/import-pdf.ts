import type paper from "paper/dist/paper-core";
import { getPdfjs } from "@/lib/pdf-client";
import type { ParsedVectorImport } from "./import-svg";

type PaperScope = typeof paper;
type M = [number, number, number, number, number, number];

const IDENTITY: M = [1, 0, 0, 1, 0, 0];

/** pdf.js Util.transform: apply m inside ctm (m first, then ctm). */
function concat(ctm: M, m: M): M {
  return [
    m[0] * ctm[0] + m[1] * ctm[2],
    m[0] * ctm[1] + m[1] * ctm[3],
    m[2] * ctm[0] + m[3] * ctm[2],
    m[2] * ctm[1] + m[3] * ctm[3],
    m[4] * ctm[0] + m[5] * ctm[2] + ctm[4],
    m[4] * ctm[1] + m[5] * ctm[3] + ctm[5],
  ];
}

interface GState {
  ctm: M;
  fill: string;
  stroke: string;
  fillAlpha: number;
  strokeAlpha: number;
  lineWidth: number;
  dash: number[];
  cap: string;
  join: string;
  miter: number;
}

const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/**
 * Imports one page of a vector PDF (e.g. a CorelDRAW export) at exact size:
 * PDF points are 1/72 in. Paths, fills, strokes, transforms and form
 * XObjects are converted; text and images are reported, not imported.
 */
export async function parsePdf(ps: PaperScope, bytes: ArrayBuffer, fileName: string, pageNumber = 1): Promise<ParsedVectorImport & { pageCount: number }> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  const pageCount = doc.numPages;
  const page = await doc.getPage(Math.min(Math.max(1, pageNumber), pageCount));
  const OPS = pdfjs.OPS;
  const [vx0, vy0, vx1, vy1] = page.view; // PDF points
  const widthIn = (vx1 - vx0) / 72;
  const heightIn = (vy1 - vy0) / 72;
  const warnings: string[] = [];
  if (page.rotate) warnings.push(`The page has a /Rotate of ${page.rotate}° — imported unrotated.`);

  // PDF user space (y up, points) -> inches (y down), page top-left at 0,0.
  const toIn = (ctm: M, x: number, y: number) => {
    const px = ctm[0] * x + ctm[2] * y + ctm[4];
    const py = ctm[1] * x + ctm[3] * y + ctm[5];
    return new ps.Point((px - vx0) / 72, (vy1 - py) / 72);
  };

  const ops = await page.getOperatorList();
  const root = new ps.Group({ insert: false });
  const stack: GState[] = [];
  let gs: GState = { ctm: IDENTITY, fill: "#000000", stroke: "#000000", fillAlpha: 1, strokeAlpha: 1, lineWidth: 1, dash: [], cap: "butt", join: "miter", miter: 10 };
  let subpaths: paper.Path[] = [];
  let current: paper.Path | null = null;
  let cur = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  let textOps = 0;
  let imageOps = 0;
  let clipOps = 0;

  const begin = (x: number, y: number) => {
    current = new ps.Path({ insert: false });
    current.add(toIn(gs.ctm, x, y));
    subpaths.push(current);
    cur = { x, y };
    start = { x, y };
  };
  const lineTo = (x: number, y: number) => {
    if (!current) begin(cur.x, cur.y);
    current!.add(toIn(gs.ctm, x, y));
    cur = { x, y };
  };
  const curveTo = (x1: number, y1: number, x2: number, y2: number, x: number, y: number) => {
    if (!current) begin(cur.x, cur.y);
    const p = toIn(gs.ctm, x, y);
    current!.cubicCurveTo(toIn(gs.ctm, x1, y1), toIn(gs.ctm, x2, y2), p);
    cur = { x, y };
  };
  const close = () => {
    if (current) {
      // Drop a duplicate end point that equals the start, then close.
      const segs = current.segments;
      if (segs.length > 1 && segs[segs.length - 1].point.getDistance(segs[0].point) < 1e-9) {
        segs[0].handleIn = segs[segs.length - 1].handleIn;
        current.removeSegment(segs.length - 1);
      }
      current.closed = true;
    }
    current = null;
    cur = start;
  };

  const paint = (doFill: boolean, doStroke: boolean, evenOdd: boolean) => {
    const paths = subpaths.filter((p) => p.segments.length > 1 || p.closed);
    subpaths = [];
    current = null;
    if (!paths.length || (!doFill && !doStroke)) return;
    const item: paper.Path | paper.CompoundPath = paths.length === 1 ? paths[0] : new ps.CompoundPath({ children: paths, insert: false });
    if (doFill) {
      item.fillColor = new ps.Color(gs.fill);
      item.fillColor.alpha = gs.fillAlpha;
      if (evenOdd) item.fillRule = "evenodd";
    }
    if (doStroke) {
      const scale = Math.sqrt(Math.abs(gs.ctm[0] * gs.ctm[3] - gs.ctm[1] * gs.ctm[2]));
      item.strokeColor = new ps.Color(gs.stroke);
      item.strokeColor.alpha = gs.strokeAlpha;
      // A zero-width PDF line is a device hairline; keep it visible at 0.001 in.
      item.strokeWidth = Math.max((gs.lineWidth * scale) / 72, 0.001);
      if (gs.dash.length) item.dashArray = gs.dash.map((d) => (d * scale) / 72);
      item.strokeCap = gs.cap;
      item.strokeJoin = gs.join;
      item.miterLimit = gs.miter;
    }
    root.addChild(item);
  };

  const CAPS = ["butt", "round", "square"];
  const JOINS = ["miter", "round", "bevel"];

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i] as unknown[];
    switch (fn) {
      case OPS.save:
        stack.push({ ...gs, dash: [...gs.dash] });
        break;
      case OPS.restore:
        if (stack.length) gs = stack.pop()!;
        break;
      case OPS.transform:
        gs = { ...gs, ctm: concat(gs.ctm, args as M) };
        break;
      case OPS.paintFormXObjectBegin: {
        stack.push({ ...gs, dash: [...gs.dash] });
        const m = args[0] as M | null;
        if (m) gs = { ...gs, ctm: concat(gs.ctm, m) };
        break;
      }
      case OPS.paintFormXObjectEnd:
        if (stack.length) gs = stack.pop()!;
        break;
      case OPS.setLineWidth:
        gs = { ...gs, lineWidth: args[0] as number };
        break;
      case OPS.setLineCap:
        gs = { ...gs, cap: CAPS[args[0] as number] ?? "butt" };
        break;
      case OPS.setLineJoin:
        gs = { ...gs, join: JOINS[args[0] as number] ?? "miter" };
        break;
      case OPS.setMiterLimit:
        gs = { ...gs, miter: args[0] as number };
        break;
      case OPS.setDash:
        gs = { ...gs, dash: [...((args[0] as number[]) ?? [])] };
        break;
      case OPS.setGState:
        for (const [k, v] of (args[0] as [string, unknown][]) ?? []) {
          if (k === "LW") gs = { ...gs, lineWidth: v as number };
          else if (k === "CA") gs = { ...gs, strokeAlpha: v as number };
          else if (k === "ca") gs = { ...gs, fillAlpha: v as number };
          else if (k === "D") gs = { ...gs, dash: [...(((v as unknown[])?.[0] as number[]) ?? [])] };
        }
        break;
      case OPS.setFillRGBColor:
        gs = { ...gs, fill: hex(args[0] as number, args[1] as number, args[2] as number) };
        break;
      case OPS.setStrokeRGBColor:
        gs = { ...gs, stroke: hex(args[0] as number, args[1] as number, args[2] as number) };
        break;
      case OPS.setFillTransparent:
        gs = { ...gs, fillAlpha: 0 };
        break;
      case OPS.setStrokeTransparent:
        gs = { ...gs, strokeAlpha: 0 };
        break;
      case OPS.constructPath: {
        const pathOps = args[0] as number[];
        const coords = args[1] as number[];
        let j = 0;
        for (const op of pathOps) {
          if (op === OPS.moveTo) {
            begin(coords[j], coords[j + 1]);
            j += 2;
          } else if (op === OPS.lineTo) {
            lineTo(coords[j], coords[j + 1]);
            j += 2;
          } else if (op === OPS.curveTo) {
            curveTo(coords[j], coords[j + 1], coords[j + 2], coords[j + 3], coords[j + 4], coords[j + 5]);
            j += 6;
          } else if (op === OPS.curveTo2) {
            curveTo(cur.x, cur.y, coords[j], coords[j + 1], coords[j + 2], coords[j + 3]);
            j += 4;
          } else if (op === OPS.curveTo3) {
            curveTo(coords[j], coords[j + 1], coords[j + 2], coords[j + 3], coords[j + 2], coords[j + 3]);
            j += 4;
          } else if (op === OPS.closePath) {
            close();
          } else if (op === OPS.rectangle) {
            const [x, y, w, h] = coords.slice(j, j + 4);
            begin(x, y);
            lineTo(x + w, y);
            lineTo(x + w, y + h);
            lineTo(x, y + h);
            close();
            j += 4;
          }
        }
        break;
      }
      case OPS.closePath:
        close();
        break;
      case OPS.fill:
        paint(true, false, false);
        break;
      case OPS.eoFill:
        paint(true, false, true);
        break;
      case OPS.stroke:
        paint(false, true, false);
        break;
      case OPS.closeStroke:
        close();
        paint(false, true, false);
        break;
      case OPS.fillStroke:
        paint(true, true, false);
        break;
      case OPS.eoFillStroke:
        paint(true, true, true);
        break;
      case OPS.closeFillStroke:
        close();
        paint(true, true, false);
        break;
      case OPS.closeEOFillStroke:
        close();
        paint(true, true, true);
        break;
      case OPS.endPath:
        subpaths = [];
        current = null;
        break;
      case OPS.clip:
      case OPS.eoClip:
        clipOps++;
        break;
      case OPS.showText:
      case OPS.showSpacedText:
      case OPS.nextLineShowText:
      case OPS.nextLineSetSpacingShowText:
        textOps++;
        break;
      case OPS.paintImageXObject:
      case OPS.paintInlineImageXObject:
      case OPS.paintImageMaskXObject:
        imageOps++;
        break;
    }
  }
  await doc.destroy();

  if (textOps) warnings.push(`${textOps} text run(s) were not imported — convert text to curves in CorelDRAW before exporting the PDF.`);
  if (imageOps) warnings.push(`${imageOps} image(s) inside the PDF were not imported — import images separately as PNG/JPG.`);
  if (clipOps) warnings.push(`${clipOps} clipping path(s) were ignored (content imported unclipped).`);
  if (!root.children.length) warnings.push("No vector paths were found on this page.");

  const detail = `PDF page ${Math.min(Math.max(1, pageNumber), pageCount)} of ${pageCount}: ${(vx1 - vx0).toFixed(2)} × ${(vy1 - vy0).toFixed(2)} pt (1 pt = 1/72 in)`;
  return { kind: "pdf", fileName, widthIn, heightIn, detail, root, rasters: [], warnings, pageCount };
}
