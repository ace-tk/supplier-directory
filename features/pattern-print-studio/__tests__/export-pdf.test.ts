import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { defaultRepeat } from "../engine/repeat";
import type { PathNode, SceneNode, Seg } from "../engine/serialize";
import { DEFAULT_EXPORT, type ExportOptions } from "../export/options";
import type { SceneDoc } from "../export/scene";
import { EXPORT_ROOT, hasAsset, saveAsset } from "../export/server/asset-store";
import { createJob, getJob, resolveDownload } from "../export/server/jobs";
import { parseColor, PDF_LAYERS, renderPdf } from "../export/server/pdf";
import { prepareScene, renderPng } from "../export/server/render";

const FIXTURES = path.join(__dirname, "fixtures");
const AREA = { x: 0, y: 0, w: 12, h: 8 };
const OPTS: ExportOptions = { ...DEFAULT_EXPORT, format: "pdf" };
const original = (id: string) => (id === "tile" ? path.join(FIXTURES, "repeat-tile.png") : id === "floral" ? path.join(FIXTURES, "floral-print.png") : null);

const rect = (x: number, y: number, w: number, h: number, style: PathNode["style"] = { stroke: "#2b2a29", strokeWidth: 0.01 }): PathNode => ({ t: "path", closed: true, segs: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py]) => [px, py, 0, 0, 0, 0] as Seg), style });

/**
 * 12 × 8 in:  A (1,1)–(4,7) bitmap tile, half-drop repeat · B (5,1)–(8,7) blue vector tile, repeat turned 17° ·
 * C (9,1)–(11.5,4) one placement print (1600 px floral, 3 in wide = 533 DPI) · a red square · a notch · a label · an empty tagged gusset.
 */
function sampleDoc(): SceneDoc {
  const tileA: SceneNode = { t: "raster", assetId: "tile", matrix: [1 / 400, 0, 0, 1 / 400, 2, 4], width: 400, height: 400 };
  const tileB = rect(6, 3, 0.7, 0.7, { fill: "#204080" });
  const print: SceneNode = { t: "raster", assetId: "floral", name: "floral-print.png", matrix: [3 / 1600, 0, 0, 3 / 1600, 10.25, 2.5], width: 1600, height: 1600 };
  const objects: SceneNode[] = [
    { t: "powerclip", pc: { lock: true, repeat: { ...defaultRepeat(1, 1), type: "half-drop" } }, frame: { ...rect(1, 1, 3, 6), tag: { size: "S", piece: "Front" } }, contents: [tileA], tile: [1.5, 3.5, 1, 1] },
    { t: "powerclip", pc: { lock: true, repeat: { ...defaultRepeat(0.7, 0.7), rotation: 17 } }, frame: { ...rect(5, 1, 3, 6), tag: { size: "S", piece: "Back" } }, contents: [tileB], tile: [6, 3, 0.7, 0.7] },
    { t: "powerclip", pc: { lock: true }, frame: { ...rect(9, 1, 2.5, 3), tag: { size: "S", piece: "Waistband" } }, contents: [print] },
    rect(9, 6, 0.6, 0.6, { fill: "#ff0000" }),
    { t: "path", closed: false, segs: [[4.2, 4, 0, 0, 0, 0], [4.8, 4, 0, 0, 0, 0]], style: { stroke: "#000000", strokeWidth: 0.01 } },
    { t: "text", content: "S", matrix: [1, 0, 0, 1, 10, 7.5], fontFamily: "Arimo", fontWeight: 700, fontSize: 0.8, justification: "left", style: { fill: "#000000" } },
    { ...rect(9, 4.6, 1.5, 1, { fill: "#e6e7e8", stroke: "#2b2a29", strokeWidth: 0.01 }), tag: { size: "S", piece: "Gusset" } },
  ];
  return { name: "PDF Sample", settings: { bleed: { amount: 0.25, visible: true }, cutLines: { visible: true, color: "#000000", width: 0.5 / 72 } }, objects };
}

async function make(dir: string, name: string, options: Partial<ExportOptions> = {}, area = AREA) {
  const file = path.join(dir, name);
  const out = await renderPdf({ doc: sampleDoc(), area, options: { ...OPTS, ...options }, originalPath: original, assetName: (id) => `${id}.png` }, file);
  return { out, file };
}

/** Reads a PDF back with pdf.js — an independent reader (the one browsers use). */
async function inspect(file: string) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await readFile(file));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: false, verbosity: 0 }).promise;
  const page = await doc.getPage(1);
  const view = page.getViewport({ scale: 1 });
  const ops = await page.getOperatorList();
  const count = (fn: number) => ops.fnArray.filter((f: number) => f === fn).length;
  const oc = await doc.getOptionalContentConfig();
  const found = Object.values((oc.getGroups() ?? {}) as Record<string, { name: string; visible: boolean }>);
  const groups = PDF_LAYERS.map((name) => found.find((g) => g.name === name)).filter((g): g is { name: string; visible: boolean } => !!g).map((g) => ({ name: g.name, visible: g.visible }));
  const result = {
    pages: doc.numPages,
    width: view.width,
    height: view.height,
    clips: count(pdfjs.OPS.clip) + count(pdfjs.OPS.eoClip),
    imageDraws: count(pdfjs.OPS.paintImageXObject),
    formDraws: count(pdfjs.OPS.paintFormXObjectBegin),
    textRuns: count(pdfjs.OPS.showText),
    layerMarks: count(pdfjs.OPS.beginMarkedContentProps),
    groups,
  };
  await doc.destroy();
  return result;
}

/** How many image and form XObjects the file really stores. */
async function stored(file: string) {
  const pdf = await PDFDocument.load(await readFile(file));
  let images = 0;
  let forms = 0;
  const widths: number[] = [];
  for (const [, obj] of pdf.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream) && !("dict" in (obj as object))) continue;
    const dict = (obj as PDFRawStream).dict;
    const subtype = dict?.get(PDFName.of("Subtype"));
    if (subtype === PDFName.of("Image") && dict.get(PDFName.of("ColorSpace")) !== PDFName.of("DeviceGray")) {
      images++;
      widths.push(Number(String(dict.get(PDFName.of("Width")))));
    }
    if (subtype === PDFName.of("Form")) forms++;
  }
  return { images, forms, widths: widths.sort((a, b) => a - b), page: pdf.getPage(0).getSize() };
}

describe("editable PDF", () => {
  it("colours", () => {
    expect(parseColor("#204080")).toEqual({ r: 0x20 / 255, g: 0x40 / 255, b: 0x80 / 255, a: 1 });
    expect(parseColor("#fff")).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(parseColor("rgba(255, 0, 0, 0.5)")).toEqual({ r: 1, g: 0, b: 0, a: 0.5 });
    expect(parseColor("none")).toBeNull();
    expect(parseColor(null)).toBeNull();
  });

  it("the page is the export area at exact size: 1 in = 72 pt", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "pps-pdf-"));
    try {
      const { out, file } = await make(dir, "a.pdf");
      expect([out.widthPt, out.heightPt]).toEqual([864, 576]);
      const read = await inspect(file);
      expect(read.pages).toBe(1);
      expect(read.width).toBeCloseTo(864, 6);
      expect(read.height).toBeCloseTo(576, 6);
      // a part of the sheet: 5 × 7 in = 360 × 504 pt
      const part = await make(dir, "part.pdf", {}, { x: 6.5, y: 0.5, w: 5, h: 7 });
      const p = await inspect(part.file);
      expect(p.width).toBeCloseTo(360, 6);
      expect(p.height).toBeCloseTo(504, 6);
      // the full leggings sheet would be 163.75 × 37.694 in = 11790 × 2713.968 pt
      const sheet = await renderPdf({ doc: { ...sampleDoc(), objects: [] }, area: { x: 0, y: 0, w: 163.75, h: 37.694 }, options: OPTS, originalPath: original }, path.join(dir, "sheet.pdf"));
      expect(sheet.widthPt).toBeCloseTo(11790, 9);
      expect(sheet.heightPt).toBeCloseTo(2713.968, 9);
      const size = (await stored(sheet.file)).page;
      expect(size.width).toBeCloseTo(11790, 9);
      expect(size.height).toBeCloseTo(2713.968, 9);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("PowerClips are real clipping paths; each image is stored once; a repeat's tile is one object used many times", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "pps-pdf-"));
    try {
      const { out, file } = await make(dir, "a.pdf");
      const read = await inspect(file);
      const store = await stored(file);
      // three printed pieces → three clipping paths
      expect(out.clips).toBe(3);
      expect(read.clips).toBe(3);
      // two originals embedded, once each — however often they are drawn
      expect(out.images).toBe(2);
      expect(store.images).toBe(2);
      // two repeats → two tile objects, placed many times
      expect(out.tileDefs).toBe(2);
      expect(store.forms).toBe(2);
      expect(out.tiles).toBeGreaterThan(60);
      expect(read.formDraws).toBe(out.tiles);
      // the bitmap tile is drawn once per placement of its form, the placement print once
      expect(read.imageDraws).toBeGreaterThan(20);
      // the file stays small: the 400 px tile is in it once, not once per tile
      const tileBytes = (await readFile(path.join(FIXTURES, "repeat-tile.png"))).length;
      expect(out.bytes).toBeLessThan(tileBytes * 3 + 1_500_000);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("three layers — Print, Cut lines, Size labels — always present; the options decide which are switched on", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "pps-pdf-"));
    try {
      const off = await inspect((await make(dir, "off.pdf")).file);
      expect(off.groups.map((g) => g.name)).toEqual([...PDF_LAYERS]);
      expect(off.groups.map((g) => g.visible)).toEqual([true, false, false]);
      expect(off.layerMarks).toBe(3);
      const on = await inspect((await make(dir, "on.pdf", { cutLines: true, sizeLabels: true })).file);
      expect(on.groups.map((g) => g.visible)).toEqual([true, true, true]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("text: outlines by default (no font needed); editable Helvetica text when asked for", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "pps-pdf-"));
    try {
      const outlined = await make(dir, "outlined.pdf", { sizeLabels: true });
      expect(outlined.out.outlinedText).toBe(1);
      expect(outlined.out.liveText).toBe(0);
      expect((await inspect(outlined.file)).textRuns).toBe(0);
      const live = await make(dir, "live.pdf", { sizeLabels: true, pdfLiveText: true });
      expect(live.out.liveText).toBe(1);
      expect((await inspect(live.file)).textRuns).toBe(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("images above 300 effective DPI are downsampled by default, and kept at full size when that is switched off", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "pps-pdf-"));
    try {
      // the 1600 px floral is printed 3 in wide (533 DPI) → 900 px; the 400 px tile on 1 in (400 DPI) → 300 px
      const small = await make(dir, "small.pdf");
      expect(small.out.downsampled).toEqual(expect.arrayContaining([{ name: "floral.png", from: 1600, to: 900 }, { name: "tile.png", from: 400, to: 300 }]));
      expect((await stored(small.file)).widths).toEqual([300, 900]);
      // switched off: the originals go in at their full size
      const full = await make(dir, "full.pdf", { pdfDownsample: false });
      expect(full.out.downsampled).toEqual([]);
      expect((await stored(full.file)).widths).toEqual([400, 1600]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("a missing original stops the export with the file's name", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "pps-pdf-"));
    try {
      await expect(renderPdf({ doc: sampleDoc(), area: AREA, options: OPTS, originalPath: () => null, assetName: () => "floral.png" }, path.join(dir, "x.pdf"))).rejects.toThrow(/floral\.png.*missing/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  // macOS only: draw the PDF with the system's own PDF engine (the one Preview uses) and compare it with our TIFF renderer.
  it.runIf(process.platform === "darwin")("drawn by macOS Preview's engine, the PDF matches the TIFF render — plain and mirrored", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "pps-pdf-"));
    const run = promisify(execFile);
    try {
      for (const mirror of [false, true]) {
        const options = { cutLines: true, sizeLabels: true, mirror };
        const { file } = await make(dir, `m${mirror}.pdf`, options);
        const png = path.join(dir, `m${mirror}.png`);
        await run("sips", ["-s", "format", "png", "-z", "576", "864", file, "--out", png]);
        const fromPdf = await sharp(png).flatten({ background: "#ffffff" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        expect([fromPdf.info.width, fromPdf.info.height]).toEqual([864, 576]);
        const scene = await prepareScene({ doc: sampleDoc(), area: AREA, options: { ...OPTS, ...options, format: "tiff", dpi: 72 }, originalPath: original });
        const ours = await sharp(await renderPng(scene)).flatten({ background: "#ffffff" }).removeAlpha().raw().toBuffer();
        let sum = 0;
        let far = 0;
        for (let i = 0; i < ours.length; i += 3) {
          const d = Math.max(Math.abs(ours[i] - fromPdf.data[i]), Math.abs(ours[i + 1] - fromPdf.data[i + 1]), Math.abs(ours[i + 2] - fromPdf.data[i + 2]));
          sum += d;
          if (d > 64) far++;
        }
        const pixels = ours.length / 3;
        // edges antialias differently between two renderers; the pictures themselves are the same
        expect(sum / pixels).toBeLessThan(6);
        expect(far / pixels).toBeLessThan(0.04);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("PDF export as a job", () => {
  const USER = `vitest-pdf-${process.pid}-${Date.now()}`;
  afterAll(() => rm(path.join(EXPORT_ROOT, "jobs", USER), { recursive: true, force: true }));

  it("runs in the background and is downloaded as application/pdf, named {document}_{area}_{date}.pdf", async () => {
    const assets = [];
    for (const id of ["tile", "floral"]) {
      const bytes = await readFile(original(id)!);
      const hash = createHash("sha256").update(bytes).digest("hex");
      if (!(await hasAsset(hash))) await saveAsset(hash, new Blob([new Uint8Array(bytes)]).stream());
      assets.push({ id, hash, name: `${id}.png` });
    }
    const started = await createJob("/api/test", USER, { docId: "doc-pdf-1", areaLabel: "All-sizes", request: { doc: sampleDoc(), assets, area: AREA, options: OPTS } });
    expect(started.format).toBe("pdf");
    expect(started.fileName).toMatch(/^PDF-Sample_All-sizes_\d{4}-\d\d-\d\d_\d{4}\.pdf$/);
    expect([started.widthIn, started.heightIn]).toEqual([12, 8]);
    let job = await getJob("/api/test", USER, "doc-pdf-1", started.id);
    for (let i = 0; i < 600 && job && (job.status === "queued" || job.status === "running"); i++) {
      await new Promise((r) => setTimeout(r, 50));
      job = await getJob("/api/test", USER, "doc-pdf-1", started.id);
    }
    expect(job?.status).toBe("done");
    expect(job?.bytes).toBeGreaterThan(10000);
    const found = await resolveDownload(job!.id, new URL(job!.download!.url, "http://x").searchParams);
    expect(found?.contentType).toBe("application/pdf");
    expect((await readFile(found!.file)).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect((await inspect(found!.file)).width).toBeCloseTo(864, 6);
  });
});
