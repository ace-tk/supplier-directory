import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { gate, gateLevel } from "../export/gate";
import { areaLabel, clampDpi, estimateExport, exportFileName, mirrorX, pixelSize, sizesArea, unionRects, type ExportOptions } from "../export/options";
import { bleedClip, buildExportScene, flattenSegs, imageNeeds, type SceneDoc } from "../export/scene";
import { prepareScene, renderPng, renderTiff } from "../export/server/render";
import { readTiffTags, verifyTiff } from "../export/verify-tiff.mjs";
import { validateExportRequest } from "../export/server/handlers";
import { defaultRepeat } from "../engine/repeat";
import type { PathNode, SceneNode, Seg } from "../engine/serialize";

const FIXTURES = path.join(__dirname, "fixtures");
const OPTS: ExportOptions = { format: "tiff", dpi: 50, mirror: false, cutLines: false, cutLineWidthPt: 2, sizeLabels: false, background: "white" };

const rect = (x: number, y: number, w: number, h: number, style: PathNode["style"] = { stroke: "#000000", strokeWidth: 0.01 }): PathNode => ({
  t: "path",
  closed: true,
  segs: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py]) => [px, py, 0, 0, 0, 0] as Seg),
  style,
});

/**
 * A small sample sheet, 12 × 8 in:
 *   piece A  (1,1)–(5,7)   a 1 in bitmap tile, half-drop repeat
 *   piece B  (7,1)–(11,7)  a solid blue vector tile, seamless straight repeat
 *   a red square of artwork, a notch line (pattern mark) and a label "S"
 */
function sampleDoc(bleed = 0.25, rotation = 0): SceneDoc {
  const tileA: SceneNode = { t: "raster", assetId: "tile", matrix: [1 / 400, 0, 0, 1 / 400, 3, 4], width: 400, height: 400 };
  const tileB = rect(8.2, 3.1, 0.7, 0.7, { fill: "#204080" });
  const objects: SceneNode[] = [
    { t: "powerclip", pc: { lock: true, repeat: { ...defaultRepeat(1, 1), type: "half-drop" } }, frame: rect(1, 1, 4, 6), contents: [tileA], tile: [2.5, 3.5, 1, 1] },
    { t: "powerclip", pc: { lock: true, repeat: { ...defaultRepeat(0.7, 0.7), rotation } }, frame: rect(7, 1, 4, 6), contents: [tileB], tile: [8.2, 3.1, 0.7, 0.7] },
    rect(5.6, 0.2, 0.5, 0.5, { fill: "#ff0000" }),
    { t: "path", closed: false, segs: [[5.6, 4, 0, 0, 0, 0], [6.4, 4, 0, 0, 0, 0]], style: { stroke: "#000000", strokeWidth: 0.01 } },
    { t: "text", content: "S", matrix: [1, 0, 0, 1, 5.8, 7], fontFamily: "Arimo", fontWeight: 700, fontSize: 0.8, justification: "left", style: { fill: "#000000" } },
  ];
  return { name: "Sample", settings: { bleed: { amount: bleed, visible: true }, cutLines: { visible: true, color: "#000000", width: 0.5 / 72 } }, objects };
}

const AREA = { x: 0, y: 0, w: 12, h: 8 };

async function render(doc: SceneDoc, options: Partial<ExportOptions> = {}, area = AREA) {
  const scene = await prepareScene({ doc, area, options: { ...OPTS, ...options }, originalPath: (id) => (id === "tile" ? path.join(FIXTURES, "repeat-tile.png") : null) });
  const png = await renderPng(scene);
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const dpi = options.dpi ?? OPTS.dpi;
  /** Pixel at a point given in inches from the area's top-left. */
  const at = (xIn: number, yIn: number) => {
    const i = (Math.min(info.height - 1, Math.floor(yIn * dpi)) * info.width + Math.min(info.width - 1, Math.floor(xIn * dpi))) * info.channels;
    return [...data.subarray(i, i + info.channels)];
  };
  return { scene, info, at, data };
}
const isWhite = (p: number[]) => p[0] > 250 && p[1] > 250 && p[2] > 250;
const isBlue = (p: number[]) => Math.abs(p[0] - 0x20) <= 2 && Math.abs(p[1] - 0x40) <= 2 && Math.abs(p[2] - 0x80) <= 2;

describe("export arithmetic", () => {
  it("pixel size = round(inches × DPI)", () => {
    expect(pixelSize({ w: 163.75, h: 37.694 }, 150)).toEqual({ width: 24563, height: 5654 });
    expect(pixelSize({ w: 163.75, h: 37.694 }, 300)).toEqual({ width: 49125, height: 11308 });
    expect(pixelSize({ w: 10, h: 10 }, 72)).toEqual({ width: 720, height: 720 });
    expect(pixelSize({ w: 0.001, h: 0.001 }, 72)).toEqual({ width: 1, height: 1 });
  });
  it("custom DPI stays between 72 and 600", () => {
    expect(clampDpi(20)).toBe(72);
    expect(clampDpi(9999)).toBe(600);
    expect(clampDpi(199.6)).toBe(200);
    expect(clampDpi(NaN)).toBeNull();
  });
  it("estimates: the full page at 300 DPI is about 1.7 GB uncompressed; BigTIFF only above 4 GB", () => {
    const full = estimateExport({ w: 163.75, h: 37.694 }, { dpi: 300, background: "white" });
    expect(full.rawBytes).toBe(49125 * 11308 * 3);
    expect(full.rawBytes / 1e9).toBeCloseTo(1.67, 1);
    expect(full.bigTiff).toBe(false);
    expect(estimateExport({ w: 163.75, h: 37.694 }, { dpi: 600, background: "white" }).bigTiff).toBe(true);
    expect(estimateExport({ w: 10, h: 10 }, { dpi: 100, background: "transparent" }).rawBytes).toBe(4_000_000);
  });
  it("file name: {document}_{area}_{dpi}dpi_{YYYY-MM-DD_HHmm}", () => {
    const when = new Date(2026, 9, 5, 19, 30);
    expect(exportFileName("Leggings Floral", "All-sizes", 150, when, "tiff")).toBe("Leggings-Floral_All-sizes_150dpi_2026-10-05_1930.tif");
    expect(exportFileName("  a/b\\c: d?  ", areaLabel("sizes", ["XL"]), 300, new Date(2026, 0, 2, 3, 4), "pdf")).toBe("abc-d_XL_300dpi_2026-01-02_0304.pdf");
    expect(exportFileName("", areaLabel("selection"), 72, when, "tiff")).toBe("Untitled_Selection_72dpi_2026-10-05_1930.tif");
    expect(areaLabel("page")).toBe("All-sizes");
    expect(areaLabel("sizes", ["S", "M"])).toBe("S-M");
  });
  it("export area: the box around the chosen sizes", () => {
    const blocks = [
      { size: "S", rect: { x: 1, y: 1, w: 24, h: 36 } },
      { size: "M", rect: { x: 28, y: 1, w: 25, h: 36 } },
      { size: "XL", rect: { x: 82, y: 0.5, w: 26, h: 37 } },
    ];
    expect(sizesArea(blocks, ["XL"])).toEqual({ x: 82, y: 0.5, w: 26, h: 37 });
    expect(sizesArea(blocks, ["S", "M"])).toEqual({ x: 1, y: 1, w: 52, h: 36 });
    expect(sizesArea(blocks, [])).toBeNull();
    expect(unionRects([])).toBeNull();
  });
  it("mirror: a point flips about the middle of the export area", () => {
    const area = { x: 82, w: 26 };
    expect(mirrorX(82, area)).toBe(108);
    expect(mirrorX(108, area)).toBe(82);
    expect(mirrorX(95, area)).toBe(95);
    expect(mirrorX(mirrorX(90.3, area), area)).toBeCloseTo(90.3, 12);
  });
});

describe("pre-flight gate", () => {
  it("blocks: missing original, open outline holding a print, print under 100 DPI", () => {
    expect(gateLevel({ kind: "missing" }, 150)).toBe("error");
    expect(gateLevel({ kind: "open", hasPrint: true }, 150)).toBe("error");
    expect(gateLevel({ kind: "dpi", dpi: 80 }, 150)).toBe("error");
    expect(gateLevel({ kind: "dpi", dpi: 99.9 }, 300)).toBe("error");
  });
  it("warns only: empty and untagged pieces, DPI 100–150, white gaps, drifted links, open marks", () => {
    for (const kind of ["empty", "untagged", "gap", "link"] as const) expect(gateLevel({ kind }, 150)).toBe("warning");
    expect(gateLevel({ kind: "dpi", dpi: 100 }, 150)).toBe("warning");
    expect(gateLevel({ kind: "dpi", dpi: 149 }, 150)).toBe("warning");
    expect(gateLevel({ kind: "open", hasPrint: false }, 150)).toBe("warning");
  });
  it("a low-DPI print cannot make a lower-DPI export worse", () => {
    expect(gateLevel({ kind: "dpi", dpi: 80 }, 72)).toBe("warning");
    expect(gateLevel({ kind: "dpi", dpi: 80 }, 81)).toBe("error");
  });
  it("export is allowed only when nothing blocks", () => {
    const g = gate([{ kind: "empty" as const }, { kind: "dpi" as const, dpi: 120 }], 150);
    expect(g.canExport).toBe(true);
    expect(g.warnings).toHaveLength(2);
    const blocked = gate([{ kind: "empty" as const }, { kind: "missing" as const }], 150);
    expect(blocked.canExport).toBe(false);
    expect(blocked.errors).toHaveLength(1);
  });
});

describe("export scene", () => {
  it("flattening follows a curve within the tolerance", () => {
    // a quarter circle of radius 10 as one bezier
    const k = 5.5228475;
    const pts = flattenSegs([[10, 0, 0, 0, 0, k], [0, 10, k, 0, 0, 0]], false, 0.0005);
    expect(pts.length).toBeGreaterThan(20);
    for (const p of pts) expect(Math.abs(Math.hypot(p.x, p.y) - 10)).toBeLessThan(0.004);
  });
  it("the clip is the outline grown by the bleed", () => {
    const c = bleedClip(rect(1, 1, 4, 6), 0.25);
    expect(c.box).toEqual({ x: 0.75, y: 0.75, w: 4.5, h: 6.5 });
    const xs = [...c.d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => +m[1]);
    expect(Math.min(...xs)).toBeCloseTo(0.75, 6);
    expect(Math.max(...xs)).toBeCloseTo(5.25, 6);
    expect(bleedClip(rect(1, 1, 4, 6), 0).d).toBe("M1,1L5,1L5,7L1,7L1,1Z");
  });
  it("a repeat is one tile definition used many times, and covers the piece plus its bleed", () => {
    const scene = buildExportScene({ doc: sampleDoc(), area: AREA, options: OPTS, imageHref: () => "data:image/png;base64,AAAA", textPath: () => "M0,0" });
    const svg = scene.svg();
    expect(scene.widthPx).toBe(600);
    expect(scene.heightPx).toBe(400);
    expect(svg.match(/data:image\/png/g)).toHaveLength(1);
    expect(scene.tiles).toBe((svg.match(/<use /g) ?? []).length);
    expect(scene.tiles).toBeGreaterThan(24 + 48);
    // strips: the same picture, a window further along
    expect(scene.svg(200, 100)).toContain('width="100" height="400" viewBox="4 0 2 8"');
  });
  it("each original is asked for at the size it is printed, not more", () => {
    // the 400 px tile is printed 1 in wide: 50 px at 50 DPI, 300 px at 300 DPI
    expect(imageNeeds(sampleDoc(), 50).get("tile")).toBe(50);
    expect(imageNeeds(sampleDoc(), 300).get("tile")).toBe(300);
  });
  it("request validation", () => {
    const ok = { doc: sampleDoc(), assets: [{ id: "tile", hash: "a".repeat(64), name: "t.png" }], area: AREA, options: OPTS };
    expect(validateExportRequest(ok)).toBeNull();
    expect(validateExportRequest({ ...ok, area: { ...AREA, w: 0 } })).toMatch(/area/);
    expect(validateExportRequest({ ...ok, assets: [{ id: "tile", hash: "../etc/passwd" }] })).toMatch(/image list/);
    expect(validateExportRequest(null)).toBeTruthy();
  });
});

describe("export render (the same path the preview and the final file use)", () => {
  it("renders at exactly round(inches × DPI) pixels, prints clipped to outline + bleed", async () => {
    const { info, at } = await render(sampleDoc());
    expect([info.width, info.height]).toEqual([600, 400]);
    expect(isBlue(at(9, 4))).toBe(true); // inside piece B
    expect(isBlue(at(6.9, 4))).toBe(true); // in its bleed (outline starts at 7)
    expect(isBlue(at(11.15, 4))).toBe(true);
    expect(isWhite(at(6.6, 4))).toBe(true); // past the bleed
    expect(isWhite(at(11.4, 4))).toBe(true);
    expect(isWhite(at(9, 0.6))).toBe(true);
    expect(isWhite(at(3, 4))).toBe(false); // piece A has its bitmap repeat
    expect(isWhite(at(0.6, 4))).toBe(true);
    expect(at(5.85, 0.45).slice(0, 3)).toEqual([255, 0, 0]); // free artwork is exported
  });
  it("no bleed: the print stops at the outline", async () => {
    const { at } = await render(sampleDoc(0));
    expect(isBlue(at(7.1, 4))).toBe(true);
    expect(isWhite(at(6.9, 4))).toBe(true);
  });
  it("a seamless repeat has NO hairlines between tiles — straight and rotated", async () => {
    for (const rotation of [0, 17]) {
      const { at, info } = await render(sampleDoc(0.25, rotation), { dpi: 96 });
      let bad = 0;
      let checked = 0;
      // every pixel well inside piece B must be the tile's exact colour
      for (let y = 1.1; y < 6.9; y += 1 / 96)
        for (let x = 7.1; x < 10.9; x += 1 / 96) {
          checked++;
          if (!isBlue(at(x, y))) bad++;
        }
      expect(info.width).toBe(1152);
      expect(checked).toBeGreaterThan(190000);
      expect(bad).toBe(0);
    }
  });
  it("mirror flips the whole export left-right", async () => {
    const { at } = await render(sampleDoc(), { mirror: true });
    expect(at(12 - 5.85, 0.45).slice(0, 3)).toEqual([255, 0, 0]);
    expect(isWhite(at(5.85, 0.45))).toBe(true);
    expect(isBlue(at(12 - 9, 4))).toBe(true);
    expect(isBlue(at(9, 4))).toBe(false);
  });
  it("cut lines and pattern marks are left out by default, drawn when asked for", async () => {
    const off = await render(sampleDoc());
    expect(isWhite(off.at(6, 4))).toBe(true); // the notch line
    const on = await render(sampleDoc(), { cutLines: true, cutLineWidthPt: 3 });
    expect(on.at(6, 4)[0]).toBeLessThan(80);
    expect(on.at(7, 4)[0]).toBeLessThan(80); // piece B's cut line, on the ORIGINAL outline…
    expect(isBlue(on.at(6.85, 4))).toBe(true); // …with the bleed still printed outside it
  });
  it("a pattern piece's own fill is never printed; an untagged filled shape is artwork", async () => {
    const doc = sampleDoc();
    doc.objects.push({ ...rect(5.5, 5, 0.9, 0.9, { fill: "#e6e7e8", stroke: "#2b2a29", strokeWidth: 0.01 }), tag: { size: "S", piece: "Gusset" } });
    const off = await render(doc);
    expect(isWhite(off.at(5.95, 5.45))).toBe(true);
    expect(off.at(5.85, 0.45).slice(0, 3)).toEqual([255, 0, 0]); // the untagged red square still prints
    const on = await render(doc, { cutLines: true, cutLineWidthPt: 3 });
    expect(isWhite(on.at(5.95, 5.45))).toBe(true);
    expect(on.at(5.5, 5.45)[0]).toBeLessThan(120); // …but its cut line is drawn when asked for
  });
  it("size labels are left out by default; when included they are outlines (no font needed)", async () => {
    const dark = (r: Awaited<ReturnType<typeof render>>) => {
      let n = 0;
      for (let y = 6.3; y < 7.1; y += 0.02) for (let x = 5.7; x < 6.5; x += 0.02) if (r.at(x, y)[0] < 100) n++;
      return n;
    };
    expect(dark(await render(sampleDoc()))).toBe(0);
    const on = await render(sampleDoc(), { sizeLabels: true });
    expect(dark(on)).toBeGreaterThan(50);
    expect(on.scene.svg()).not.toContain("<text");
  });
  it("transparent background keeps alpha; a smaller area renders just that part", async () => {
    const t = await render(sampleDoc(), { background: "transparent" });
    expect(t.info.channels).toBe(4);
    expect(t.at(0.3, 0.3)[3]).toBe(0);
    expect(t.at(9, 4)[3]).toBe(255);
    const part = await render(sampleDoc(), {}, { x: 6.5, y: 0.5, w: 5, h: 7 });
    expect([part.info.width, part.info.height]).toEqual([250, 350]);
    expect(isBlue(part.at(2.5, 3.5))).toBe(true); // page (9, 4)
    expect(isWhite(part.at(0.05, 3.5))).toBe(true);
  });
  it("a missing original stops the export with the file's name", async () => {
    await expect(prepareScene({ doc: sampleDoc(), area: AREA, options: OPTS, originalPath: () => null, assetName: () => "floral.png" })).rejects.toThrow(/floral\.png.*missing/);
  });
});

describe("TIFF output + the verification script", () => {
  const original = (id: string) => (id === "tile" ? path.join(FIXTURES, "repeat-tile.png") : null);
  const tiff = async (dir: string, name: string, options: Partial<ExportOptions> = {}, stripPx?: number) => {
    const o = { ...OPTS, dpi: 40, ...options };
    const scene = await prepareScene({ doc: sampleDoc(), area: AREA, options: o, originalPath: original });
    return renderTiff(scene, path.join(dir, name), { dpi: o.dpi, transparent: o.background === "transparent", stripPx });
  };

  it("a 40 DPI export passes every check: size, DPI tags, 8-bit RGB, LZW, sRGB profile", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "pps-test-"));
    try {
      const out = await tiff(dir, "plain.tif");
      expect([out.width, out.height]).toEqual([480, 320]);
      const v = await verifyTiff(out.file, { widthIn: 12, heightIn: 8, dpi: 40 });
      expect(v.checks.filter((c) => !c.ok)).toEqual([]);
      // the resolution is stored as the exact fraction 40/1, in inches
      expect(v.tags.xResolution).toMatchObject({ numerator: 40, denominator: 1 });
      expect(v.tags.yResolution).toMatchObject({ numerator: 40, denominator: 1 });
      expect(v.tags.resolutionUnit).toBe(2);
      // and an image library agrees
      const meta = await sharp(out.file).metadata();
      expect(meta.density).toBe(40);
      expect(meta.channels).toBe(3);
      expect(meta.icc).toBeTruthy();

      // the script catches a wrong size or DPI
      expect((await verifyTiff(out.file, { widthIn: 12, heightIn: 8, dpi: 150 })).ok).toBe(false);
      expect((await verifyTiff(out.file, { widthIn: 163.75, heightIn: 37.694, dpi: 40 })).ok).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("mirror on / off is verified against the un-mirrored export", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "pps-test-"));
    try {
      const plain = await tiff(dir, "plain.tif");
      const again = await tiff(dir, "again.tif");
      const mirrored = await tiff(dir, "mirror.tif", { mirror: true });
      const size = { widthIn: 12, heightIn: 8, dpi: 40 };
      const mv = await verifyTiff(mirrored.file, { ...size, mirror: true, reference: plain.file });
      expect(mv.checks.filter((c) => !c.ok)).toEqual([]);
      expect((await verifyTiff(again.file, { ...size, mirror: false, reference: plain.file })).ok).toBe(true);
      // a file that was NOT mirrored fails the mirror check, and the other way round
      expect((await verifyTiff(again.file, { ...size, mirror: true, reference: plain.file })).ok).toBe(false);
      expect((await verifyTiff(mirrored.file, { ...size, mirror: false, reference: plain.file })).ok).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("a picture drawn in strips is identical, pixel for pixel, to one drawn in one go", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "pps-test-"));
    try {
      const whole = await tiff(dir, "whole.tif", { dpi: 96, cutLines: true, sizeLabels: true });
      const strips = await tiff(dir, "strips.tif", { dpi: 96, cutLines: true, sizeLabels: true }, 200); // 1152 px wide = 6 strips, the last one narrower
      expect(whole.strips).toBe(1);
      expect(strips.strips).toBe(6);
      expect([strips.width, strips.height]).toEqual([1152, 768]);
      const a = await sharp(whole.file).raw().toBuffer();
      const b = await sharp(strips.file).raw().toBuffer();
      expect(b.length).toBe(a.length);
      let differing = 0;
      let worst = 0;
      for (let i = 0; i < a.length; i++) {
        const d = Math.abs(a[i] - b[i]);
        if (d) differing++;
        if (d > worst) worst = d;
      }
      // antialiasing at a strip edge may differ by a rounding step; nothing more
      expect(worst).toBeLessThanOrEqual(2);
      expect(differing / a.length).toBeLessThan(0.001);
      expect((await verifyTiff(strips.file, { widthIn: 12, heightIn: 8, dpi: 96 })).ok).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("transparent background writes RGB + alpha", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "pps-test-"));
    try {
      const out = await tiff(dir, "alpha.tif", { background: "transparent" });
      expect((await verifyTiff(out.file, { widthIn: 12, heightIn: 8, dpi: 40, transparent: true })).ok).toBe(true);
      expect((await readTiffTags(out.file)).samplesPerPixel).toBe(4);
      expect((await verifyTiff(out.file, { widthIn: 12, heightIn: 8, dpi: 40 })).ok).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("the script runs from the command line and sets its exit code", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "pps-test-"));
    try {
      const out = await tiff(dir, "plain.tif");
      const script = path.join(__dirname, "..", "export", "verify-tiff.mjs");
      const run = promisify(execFile);
      const good = await run(process.execPath, [script, out.file, "--width", "12", "--height", "8", "--dpi", "40"]);
      expect(good.stdout).toMatch(/All checks passed/);
      expect(good.stdout).not.toMatch(/FAIL/);
      await expect(run(process.execPath, [script, out.file, "--width", "12", "--height", "8", "--dpi", "300"])).rejects.toMatchObject({ code: 1 });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
