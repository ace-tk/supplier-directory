// The export renderer. Server only (uses sharp / libvips).
//
//   document JSON → scene SVG (../scene.ts) → rasterised in vertical strips
//   → joined and written out
//
// Originals are converted to sRGB and resampled to the size they are needed
// at before they go into the scene. Nothing here ever holds the whole
// uncompressed picture in JS memory: libvips streams it.

import { mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { parse as parseFont, type Font } from "opentype.js";
import sharp from "sharp";
import { outlineWeight } from "../../engine/fonts";
import type { TextNode } from "../../engine/serialize";
import type { ExportOptions, Rect } from "../options";
import { buildExportScene, imageNeeds, type ExportScene, type SceneDoc } from "../scene";
import { textOutlineData } from "../text-outline";
import { setTiffResolution } from "../verify-tiff.mjs";
import { BIGTIFF_BYTES } from "../options";
import { EXPORT_ROOT } from "./asset-store";

/** The SVG rasteriser cannot draw anything wider than 32,767 px, so wide pictures are drawn in strips of this width and joined. */
export const STRIP_PX = 8192;

export interface RenderInput {
  doc: SceneDoc;
  area: Rect;
  options: ExportOptions;
  /** Path of the ORIGINAL file of an asset, or null if the server does not have it. */
  originalPath: (assetId: string) => string | null;
  /** Display name of an asset, for messages. */
  assetName?: (assetId: string) => string;
}

export class ExportError extends Error {}

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

function collectText(nodes: SceneDoc["objects"], out: TextNode[] = []): TextNode[] {
  for (const n of nodes) {
    if (n.t === "text") out.push(n);
    else if (n.t === "group") collectText(n.children, out);
    else if (n.t === "powerclip") collectText(n.contents, out);
  }
  return out;
}

/**
 * An original, ready to be drawn: upright (EXIF), converted to sRGB from
 * whatever profile it carries (Adobe RGB, CMYK…), and no larger than this
 * export needs. Returned as a PNG data: URI.
 */
async function prepareImage(file: string, neededWidth: number, name: string): Promise<string> {
  try {
    const src = sharp(file, { limitInputPixels: false, failOn: "error" }).autoOrient();
    const meta = await src.metadata();
    const width = meta.autoOrient?.width ?? meta.width ?? 0;
    let img = src.toColourspace("srgb");
    if (neededWidth > 0 && width > neededWidth) img = img.resize({ width: Math.max(1, neededWidth), kernel: "lanczos3" });
    const png = await img.png({ compressionLevel: 3 }).toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch (err) {
    throw new ExportError(`The original image "${name}" could not be read (${err instanceof Error ? err.message : "unknown error"}). Import it again and retry.`);
  }
}

/** Builds the scene for one export: prepares every image and text outline it needs. */
export async function prepareScene(input: RenderInput): Promise<ExportScene> {
  const { doc, options } = input;
  const needs = imageNeeds(doc, options.dpi);
  const hrefs = new Map<string, string>();
  for (const [id, width] of needs) {
    const file = input.originalPath(id);
    if (!file) throw new ExportError(`The original image "${input.assetName?.(id) ?? id}" is missing. Import it again and retry.`);
    hrefs.set(id, await prepareImage(file, width, input.assetName?.(id) ?? id));
  }
  const outlines = new Map<TextNode, string | null>();
  for (const t of collectText(doc.objects)) {
    try {
      outlines.set(t, textOutlineData(t, await outlineFont(outlineWeight(t.fontWeight))));
    } catch {
      outlines.set(t, null);
    }
  }
  return buildExportScene({ ...input, imageHref: (id) => hrefs.get(id) ?? null, textPath: (t) => outlines.get(t) ?? null });
}

const svgInput = (svg: string) => sharp(Buffer.from(svg), { density: 72, limitInputPixels: false, unlimited: true });

/** A small PNG of the scene — used for the dialog's preview (the scene decides the size). */
export async function renderPng(scene: ExportScene): Promise<Buffer> {
  if (scene.widthPx > STRIP_PX * 3) throw new ExportError("This picture is too large for a PNG preview.");
  return svgInput(scene.svg()).png({ compressionLevel: 6 }).toBuffer();
}

export interface TiffResult {
  file: string;
  width: number;
  height: number;
  bytes: number;
  bigTiff: boolean;
  strips: number;
  /** Seconds spent drawing the strips, and joining + compressing them. */
  renderSeconds: number;
  writeSeconds: number;
}

export type ExportStep = "rendering" | "stitching" | "compressing";

/**
 * Writes the scene as a print-ready TIFF: 8-bit RGB (RGB + alpha when the
 * background is transparent), LZW, the sRGB profile embedded, and the
 * resolution tags set to exactly `dpi` so it opens at its true size.
 *
 * A wide picture is drawn strip by strip into temporary files and then
 * joined by libvips, which streams rows from the strips straight into the
 * output — the whole uncompressed image is never in memory.
 */
export async function renderTiff(scene: ExportScene, file: string, opts: { dpi: number; transparent: boolean; onProgress?: (step: ExportStep, fraction: number) => void; signal?: AbortSignal; /** Strip width, px (tests use a small one). */ stripPx?: number }): Promise<TiffResult> {
  const { widthPx: W, heightPx: H } = scene;
  const stripPx = Math.max(16, Math.min(STRIP_PX, opts.stripPx ?? STRIP_PX));
  const count = Math.ceil(W / stripPx);
  const channels = opts.transparent ? 4 : 3;
  const bigTiff = W * H * channels > BIGTIFF_BYTES;
  const work = path.join(EXPORT_ROOT, "tmp", `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const stop = () => {
    if (opts.signal?.aborted) throw new ExportError("The export was cancelled.");
  };
  const finish = (img: sharp.Sharp) => (opts.transparent ? img.ensureAlpha() : img.flatten({ background: "#ffffff" }).removeAlpha());
  await mkdir(work, { recursive: true });
  await mkdir(path.dirname(file), { recursive: true });
  try {
    const t0 = Date.now();
    let source: sharp.Sharp;
    if (count === 1) {
      opts.onProgress?.("rendering", 0);
      source = svgInput(scene.svg());
    } else {
      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        stop();
        opts.onProgress?.("rendering", i / count);
        const x0 = i * stripPx;
        const part = path.join(work, `strip-${i}.tif`);
        // Strips are working files: fast, lossless, and read back row by row when joined.
        await finish(svgInput(scene.svg(x0, Math.min(stripPx, W - x0)))).tiff({ compression: "lzw", predictor: "horizontal" }).toFile(part);
        parts.push(part);
      }
      opts.onProgress?.("stitching", 0);
      // Every cell of the join is one strip wide; the last strip is narrower, so the surplus on the right is cut off.
      source = sharp(parts, { join: { across: count, halign: "left", valign: "top" }, limitInputPixels: false }).extract({ left: 0, top: 0, width: W, height: H });
    }
    const t1 = Date.now();
    stop();
    // With a single strip, drawing and compressing are one pass — there is no separate step to report.
    if (count > 1) opts.onProgress?.("compressing", 0);
    const info = await finish(source)
      .withIccProfile("srgb")
      .tiff({ compression: "lzw", predictor: "horizontal", xres: opts.dpi / 25.4, yres: opts.dpi / 25.4, resolutionUnit: "inch", bigtiff: bigTiff })
      .toFile(file);
    await setTiffResolution(file, opts.dpi);
    if (info.width !== W || info.height !== H) throw new ExportError(`The export came out ${info.width} × ${info.height} px instead of ${W} × ${H} px.`);
    return { file, width: W, height: H, bytes: (await stat(file)).size, bigTiff, strips: count, renderSeconds: (t1 - t0) / 1000, writeSeconds: (Date.now() - t1) / 1000 };
  } catch (err) {
    await rm(file, { force: true });
    throw err;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
