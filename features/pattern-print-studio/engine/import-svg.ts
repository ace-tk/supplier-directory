import type paper from "paper/dist/paper-core";
import type { RasterAsset } from "./types";
import { cssLengthToInches } from "./units";
import { loadImageElement, newId } from "./assets";

type PaperScope = typeof paper;

export interface ParsedVectorImport {
  kind: "svg" | "pdf";
  fileName: string;
  /** The file's own page size, inches. */
  widthIn: number;
  heightIn: number;
  /** Human-readable explanation of how the size was detected. */
  detail: string;
  /** Content at real size, in inches, with the file's top-left at (0,0). Not inserted. */
  root: paper.Group;
  rasters: { asset: RasterAsset; img: HTMLImageElement; raster: paper.Raster }[];
  warnings: string[];
}

// Presentation properties Paper.js reads as attributes.
const STYLE_PROPS = new Set([
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "opacity",
  "display",
  "visibility",
  "font-family",
  "font-size",
  "font-weight",
  "text-anchor",
  "clip-rule",
]);

function parseDeclarations(text: string): [string, string][] {
  return text
    .split(";")
    .map((d) => d.split(":"))
    .filter((p) => p.length >= 2)
    .map(([k, ...v]) => [k.trim().toLowerCase(), v.join(":").replace(/!important/i, "").trim()] as [string, string])
    .filter(([k, v]) => k && v);
}

/**
 * CorelDRAW (and Illustrator) put fills/outlines in a <style> block with
 * classes (.fil0, .str0…). Paper.js ignores <style>, so resolve every rule
 * onto elements as presentation attributes (precedence: inline style >
 * stylesheet rules in order > existing attributes).
 */
function inlineStylesheets(doc: Document) {
  const resolved = new Map<Element, Map<string, string>>();
  const set = (el: Element, k: string, v: string) => {
    let m = resolved.get(el);
    if (!m) resolved.set(el, (m = new Map()));
    m.set(k, v);
  };
  for (const styleEl of Array.from(doc.querySelectorAll("style"))) {
    const css = (styleEl.textContent || "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!\[CDATA\[|\]\]>/g, "");
    const ruleRe = /([^{}]+)\{([^}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = ruleRe.exec(css))) {
      const decls = parseDeclarations(m[2]);
      for (const selector of m[1].split(",").map((s) => s.trim()).filter(Boolean)) {
        if (selector.startsWith("@")) continue;
        let els: Element[] = [];
        try {
          els = Array.from(doc.querySelectorAll(selector));
        } catch {
          continue; // unsupported selector
        }
        for (const el of els) for (const [k, v] of decls) set(el, k, v);
      }
    }
    styleEl.remove();
  }
  for (const el of Array.from(doc.querySelectorAll("[style]"))) {
    for (const [k, v] of parseDeclarations(el.getAttribute("style") || "")) set(el, k, v);
    el.removeAttribute("style");
  }
  for (const [el, props] of resolved) {
    for (const [k, v] of props) if (STYLE_PROPS.has(k)) el.setAttribute(k, v);
  }
}

/** Replaces <use>-created SymbolItems with real geometry, recursively. */
function expandSymbols(ps: PaperScope, item: paper.Item) {
  for (const child of [...(item.children ?? [])]) {
    if (child instanceof ps.SymbolItem) {
      const copy = child.definition.item.clone({ insert: false });
      copy.transform(child.matrix);
      child.replaceWith(copy);
      expandSymbols(ps, copy);
    } else {
      expandSymbols(ps, child);
    }
  }
}

/** Bakes transforms into geometry so every path is in absolute inches. */
function normalize(ps: PaperScope, item: paper.Item, strokeScale: number) {
  if (item instanceof ps.Path || item instanceof ps.CompoundPath || item instanceof ps.Group) item.applyMatrix = true;
  if ((item instanceof ps.Path || item instanceof ps.CompoundPath) && item.strokeColor) {
    item.strokeWidth = item.strokeWidth * strokeScale;
    if (item.dashArray?.length) item.dashArray = item.dashArray.map((d) => d * strokeScale);
  }
  if (item instanceof ps.Group) for (const c of item.children) normalize(ps, c, strokeScale);
}

export async function parseSvg(ps: PaperScope, text: string, fileName: string): Promise<ParsedVectorImport> {
  const warnings: string[] = [];
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) throw new Error("This file isn't a valid SVG.");

  const vb = (svg.getAttribute("viewBox") || "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const hasVb = vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0;
  const wIn = cssLengthToInches(svg.getAttribute("width"));
  const hIn = cssLengthToInches(svg.getAttribute("height"));

  // user unit -> inches, plus offsets (preserveAspectRatio "xMidYMid meet" default).
  let sx = 1 / 96;
  let sy = 1 / 96;
  let ox = 0;
  let oy = 0;
  let widthIn: number;
  let heightIn: number;
  let detail: string;
  if (hasVb) {
    const [minX, minY, vw, vh] = vb;
    widthIn = wIn ?? (hIn ? (hIn * vw) / vh : vw / 96);
    heightIn = hIn ?? (wIn ? (wIn * vh) / vw : vh / 96);
    sx = widthIn / vw;
    sy = heightIn / vh;
    const par = (svg.getAttribute("preserveAspectRatio") || "xMidYMid meet").trim();
    if (par !== "none" && Math.abs(sx - sy) / Math.max(sx, sy) > 1e-9) {
      const s = par.includes("slice") ? Math.max(sx, sy) : Math.min(sx, sy);
      const align = par.split(/\s+/)[0];
      const fx = align.includes("xMin") ? 0 : align.includes("xMax") ? 1 : 0.5;
      const fy = align.includes("YMin") ? 0 : align.includes("YMax") ? 1 : 0.5;
      ox = (widthIn - vw * s) * fx;
      oy = (heightIn - vh * s) * fy;
      sx = sy = s;
      warnings.push("The SVG's width/height and viewBox have different aspect ratios — applied preserveAspectRatio.");
    }
    ox -= minX * sx;
    oy -= minY * sy;
    detail = `width="${svg.getAttribute("width") ?? "—"}" height="${svg.getAttribute("height") ?? "—"}" viewBox="${vb.join(" ")}" → 1 SVG unit = ${+sx.toPrecision(8)} in`;
  } else {
    widthIn = wIn ?? 0;
    heightIn = hIn ?? 0;
    detail = `No viewBox — SVG units treated as CSS px (96 px = 1 in)`;
    if (!wIn || !hIn) warnings.push("The SVG has no absolute width/height — size assumed from 96 px per inch.");
  }

  inlineStylesheets(doc);
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.removeAttribute("viewBox");
  svg.removeAttribute("preserveAspectRatio");

  const imported = ps.project.importSVG(new XMLSerializer().serializeToString(svg), { insert: false, expandShapes: true }) as paper.Item | null;
  if (!imported) throw new Error("No drawable content was found in this SVG.");
  const root = imported instanceof ps.Group ? imported : new ps.Group({ children: [imported], insert: false });

  expandSymbols(ps, root);
  normalize(ps, root, Math.sqrt(Math.abs(sx * sy)));
  root.transform(new ps.Matrix(sx, 0, 0, sy, ox, oy));

  // Embedded images → raster assets (the original data is kept for export).
  const rasters: ParsedVectorImport["rasters"] = [];
  for (const r of root.getItems({ class: ps.Raster }) as paper.Raster[]) {
    const src = r.source as string;
    if (!src || !src.startsWith("data:")) {
      warnings.push("A linked (non-embedded) image was skipped — embed images when exporting the SVG.");
      r.remove();
      continue;
    }
    try {
      const img = await loadImageElement(src);
      const realW = r.bounds.width;
      const asset: RasterAsset = {
        id: newId("a"),
        name: `${fileName} image`,
        mime: src.slice(5, src.indexOf(";")) || "image/png",
        dataUrl: src,
        pxWidth: img.naturalWidth,
        pxHeight: img.naturalHeight,
        dpi: realW > 0 ? Math.round((img.naturalWidth / realW) * 100) / 100 : 72,
      };
      rasters.push({ asset, img, raster: r });
    } catch {
      warnings.push("An embedded image couldn't be decoded and was skipped.");
      r.remove();
    }
  }

  const textCount = root.getItems({ class: ps.PointText }).length;
  if (textCount) warnings.push(`${textCount} text object(s) imported as live text — fonts must be installed to match; convert text to curves in CorelDRAW for exact shapes.`);

  return { kind: "svg", fileName, widthIn, heightIn, detail, root, rasters, warnings };
}
