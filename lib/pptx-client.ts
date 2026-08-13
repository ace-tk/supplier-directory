"use client";

// Real, local PPTX parsing — no screenshots, no server round-trip. A PPTX
// is a zip of OOXML parts; this unzips it with JSZip and reads the actual
// slide XML (text runs + picture positions) via the browser's built-in
// DOMParser, honoring the true slide order from presentation.xml's
// relationship list rather than assuming slide1.xml, slide2.xml, ... sort
// order (PowerPoint doesn't guarantee those match).
//
// Scope: text shapes and pictures are rendered as positioned boxes on a
// scaled slide canvas. Tables/charts/SmartArt/embedded video are not
// parsed — they're simply absent rather than faked.

import { dataUrlToUint8Array } from "@/lib/pdf-client";

// A minimal local surface for the JSZip instance/static API this module
// actually uses — jszip's own .d.ts (`export = JSZip`) resolves
// inconsistently between `typeof import("jszip")` type queries and the
// dynamic `import("jszip")` value expression's inferred esModuleInterop
// shape, so this sidesteps that mismatch entirely.
interface JSZipFile {
  async(type: "string"): Promise<string>;
  async(type: "base64"): Promise<string>;
}
interface JSZipArchive {
  file(path: string): JSZipFile | null;
}
interface JSZipStatic {
  loadAsync(data: Uint8Array): Promise<JSZipArchive>;
}

let jszipPromise: Promise<JSZipStatic> | null = null;

function getJSZip(): Promise<JSZipStatic> {
  if (!jszipPromise) {
    jszipPromise = import("jszip").then((mod) => (mod as unknown as { default: JSZipStatic }).default);
  }
  return jszipPromise;
}

export interface PptxTextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  sizePt: number | null;
}

export interface PptxParagraph {
  runs: PptxTextRun[];
}

export type PptxShape =
  | { kind: "text"; x: number; y: number; w: number; h: number; paragraphs: PptxParagraph[] }
  | { kind: "image"; x: number; y: number; w: number; h: number; dataUrl: string };

export interface PptxSlide {
  shapes: PptxShape[];
}

export interface PptxPresentation {
  widthEmu: number;
  heightEmu: number;
  slides: PptxSlide[];
}

const IMAGE_EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
};

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, "application/xml");
}

function isParseError(doc: Document): boolean {
  return doc.getElementsByTagName("parsererror").length > 0;
}

function tags(el: Element | Document, name: string): Element[] {
  return Array.from(el.getElementsByTagName(name));
}

function firstTag(el: Element | Document, name: string): Element | null {
  return el.getElementsByTagName(name)[0] ?? null;
}

function readRelationships(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  const doc = parseXml(xml);
  if (isParseError(doc)) return map;
  for (const rel of tags(doc, "Relationship")) {
    const id = rel.getAttribute("Id");
    const target = rel.getAttribute("Target");
    if (id && target) map.set(id, target);
  }
  return map;
}

/** Resolves a rels Target (often relative, e.g. "../media/image1.png")
 * against the directory the rels file describes. */
function resolvePath(baseDir: string, target: string): string {
  const parts = `${baseDir}/${target}`.split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

// Placeholder shapes (title/body/etc.) very commonly omit their own
// <a:xfrm> — PowerPoint has them inherit position/size from the slide
// layout's matching placeholder. Resolving that inheritance chain properly
// would mean also parsing the slide's layout XML; as a pragmatic
// middle ground, a shape with no xfrm gets a reasonable default box (sized
// by placeholder type) instead of collapsing to 0×0 and vanishing.
function fallbackBox(phType: string | null, widthEmu: number, heightEmu: number) {
  if (phType === "title" || phType === "ctrTitle") {
    return { x: widthEmu * 0.08, y: heightEmu * 0.12, w: widthEmu * 0.84, h: heightEmu * 0.22 };
  }
  if (phType === "subTitle" || phType === "body") {
    return { x: widthEmu * 0.08, y: heightEmu * 0.38, w: widthEmu * 0.84, h: heightEmu * 0.5 };
  }
  return { x: widthEmu * 0.08, y: heightEmu * 0.08, w: widthEmu * 0.84, h: heightEmu * 0.84 };
}

function defaultFontPt(phType: string | null): number {
  return phType === "title" || phType === "ctrTitle" ? 32 : 18;
}

function parseTextShape(sp: Element, widthEmu: number, heightEmu: number): PptxShape | null {
  const phType = firstTag(sp, "p:ph")?.getAttribute("type") ?? null;
  const spPr = firstTag(sp, "p:spPr");
  const xfrm = spPr ? firstTag(spPr, "a:xfrm") : null;
  const off = xfrm ? firstTag(xfrm, "a:off") : null;
  const ext = xfrm ? firstTag(xfrm, "a:ext") : null;
  const hasExplicitBox = Boolean(off && ext);
  const fallback = fallbackBox(phType, widthEmu, heightEmu);
  const x = hasExplicitBox ? Number(off?.getAttribute("x")) || 0 : fallback.x;
  const y = hasExplicitBox ? Number(off?.getAttribute("y")) || 0 : fallback.y;
  const w = hasExplicitBox ? Number(ext?.getAttribute("cx")) || 0 : fallback.w;
  const h = hasExplicitBox ? Number(ext?.getAttribute("cy")) || 0 : fallback.h;

  const txBody = firstTag(sp, "p:txBody");
  if (!txBody) return null;

  const defaultSize = defaultFontPt(phType);
  const paragraphs: PptxParagraph[] = tags(txBody, "a:p").map((p) => ({
    runs: tags(p, "a:r").flatMap((r): PptxTextRun[] => {
      const text = firstTag(r, "a:t")?.textContent ?? "";
      if (!text) return [];
      const rPr = firstTag(r, "a:rPr");
      const szAttr = rPr?.getAttribute("sz");
      return [
        {
          text,
          bold: rPr?.getAttribute("b") === "1",
          italic: rPr?.getAttribute("i") === "1",
          sizePt: szAttr ? Number(szAttr) / 100 : defaultSize,
        },
      ];
    }),
  }));

  const hasText = paragraphs.some((p) => p.runs.some((r) => r.text.trim()));
  if (!hasText) return null;
  return { kind: "text", x, y, w, h, paragraphs };
}

async function parsePicShape(
  pic: Element,
  zip: JSZipArchive,
  slideDir: string,
  slideRels: Map<string, string>
): Promise<PptxShape | null> {
  const spPr = firstTag(pic, "p:spPr");
  const xfrm = spPr ? firstTag(spPr, "a:xfrm") : null;
  const off = xfrm ? firstTag(xfrm, "a:off") : null;
  const ext = xfrm ? firstTag(xfrm, "a:ext") : null;
  const x = Number(off?.getAttribute("x")) || 0;
  const y = Number(off?.getAttribute("y")) || 0;
  const w = Number(ext?.getAttribute("cx")) || 0;
  const h = Number(ext?.getAttribute("cy")) || 0;

  const embedId = firstTag(pic, "a:blip")?.getAttribute("r:embed");
  if (!embedId) return null;
  const target = slideRels.get(embedId);
  if (!target) return null;

  const mediaPath = resolvePath(slideDir, target);
  const file = zip.file(mediaPath);
  if (!file) return null;

  const extension = mediaPath.split(".").pop()?.toLowerCase() ?? "";
  const mime = IMAGE_EXT_MIME[extension];
  if (!mime) return null; // e.g. WMF/EMF — no safe browser-renderable format, skip rather than fake

  const base64 = await file.async("base64");
  return { kind: "image", x, y, w, h, dataUrl: `data:${mime};base64,${base64}` };
}

export async function readPptx(dataUrl: string): Promise<PptxPresentation> {
  const JSZip = await getJSZip();
  const bytes = dataUrlToUint8Array(dataUrl);
  const zip = await JSZip.loadAsync(bytes);

  const presentationXml = await zip.file("ppt/presentation.xml")?.async("string");
  if (!presentationXml) throw new Error("Not a valid PPTX file.");
  const presDoc = parseXml(presentationXml);
  if (isParseError(presDoc)) throw new Error("Couldn't parse presentation.xml.");

  const sldSz = firstTag(presDoc, "p:sldSz");
  const widthEmu = Number(sldSz?.getAttribute("cx")) || 12192000;
  const heightEmu = Number(sldSz?.getAttribute("cy")) || 6858000;

  const presRelsXml = await zip.file("ppt/_rels/presentation.xml.rels")?.async("string");
  const presRels = presRelsXml ? readRelationships(presRelsXml) : new Map<string, string>();

  const slideRIds = tags(presDoc, "p:sldId")
    .map((el) => el.getAttribute("r:id") ?? "")
    .filter(Boolean);
  const slidePaths = slideRIds
    .map((rid) => presRels.get(rid))
    .filter((t): t is string => Boolean(t))
    .map((target) => resolvePath("ppt", target));

  if (slidePaths.length === 0) throw new Error("No slides found in this presentation.");

  const slides: PptxSlide[] = [];
  for (const slidePath of slidePaths) {
    const slideXml = await zip.file(slidePath)?.async("string");
    if (!slideXml) continue;
    const slideDoc = parseXml(slideXml);
    if (isParseError(slideDoc)) continue;

    const slideDir = slidePath.slice(0, slidePath.lastIndexOf("/"));
    const slideName = slidePath.slice(slidePath.lastIndexOf("/") + 1);
    const slideRelsXml = await zip.file(`${slideDir}/_rels/${slideName}.rels`)?.async("string");
    const slideRels = slideRelsXml ? readRelationships(slideRelsXml) : new Map<string, string>();

    const shapes: PptxShape[] = [];
    const spTree = firstTag(slideDoc, "p:spTree");
    if (spTree) {
      for (const child of Array.from(spTree.children)) {
        if (child.tagName === "p:sp") {
          const shape = parseTextShape(child, widthEmu, heightEmu);
          if (shape) shapes.push(shape);
        } else if (child.tagName === "p:pic") {
          const shape = await parsePicShape(child, zip, slideDir, slideRels);
          if (shape) shapes.push(shape);
        }
      }
    }

    slides.push({ shapes });
  }

  return { widthEmu, heightEmu, slides };
}

export function pptxSlideToLines(slide: PptxSlide): string[] {
  return slide.shapes
    .filter((s): s is Extract<PptxShape, { kind: "text" }> => s.kind === "text")
    .flatMap((s) => s.paragraphs.map((p) => p.runs.map((r) => r.text).join("")))
    .map((line) => line.trim())
    .filter(Boolean);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Real extracted slide text as HTML — first line of each slide becomes a
 * heading, the rest a bullet list. A structural approximation of the
 * actual content, not a fabricated summary. */
export function pptxToOutlineHtml(pres: PptxPresentation): string {
  return pres.slides
    .map((slide, i) => {
      const lines = pptxSlideToLines(slide);
      if (lines.length === 0) return `<h3>Slide ${i + 1}</h3>`;
      const [heading, ...rest] = lines;
      const bullets = rest.length ? `<ul>${rest.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>` : "";
      return `<h3>${escapeHtml(heading)}</h3>${bullets}`;
    })
    .join("");
}
