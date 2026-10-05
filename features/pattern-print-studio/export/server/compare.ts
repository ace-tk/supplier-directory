// Compares the editor's own picture of the page with an export of the same
// area, pixel by pixel. Used by the regression run to report differences
// between what the designer sees and what is printed. Server only.

import sharp from "sharp";

export interface CompareResult {
  width: number;
  height: number;
  /** Mean difference per channel, 0–255. */
  mean: number;
  /** Share of pixels that clearly differ (one channel off by more than 48 of 255), in percent. */
  differentPct: number;
  /** The same, counting only pixels where the export has print (is not white). */
  differentInPrintPct: number;
  printPct: number;
}

/**
 * `editorPng` is the editor's raster of its content at the export's DPI;
 * `offset` is where its top-left sits inside the export area, in pixels.
 * Writes a stacked picture (editor / export / differences in red) to `sideBySide`.
 */
export async function compareToEditor(editorPng: Buffer, offset: { x: number; y: number }, exportFile: string, sideBySide?: string): Promise<CompareResult> {
  const exp = sharp(exportFile, { limitInputPixels: false }).flatten({ background: "#ffffff" }).removeAlpha();
  const { width = 0, height = 0 } = await exp.metadata();
  // The editor raster covers only the objects' own box: put it on a white page of the export's size.
  const ed = await sharp(editorPng, { limitInputPixels: false }).metadata();
  const left = Math.round(offset.x);
  const top = Math.round(offset.y);
  const crop = { left: Math.max(0, -left), top: Math.max(0, -top), width: 0, height: 0 };
  crop.width = Math.min((ed.width ?? 0) - crop.left, width - Math.max(0, left));
  crop.height = Math.min((ed.height ?? 0) - crop.top, height - Math.max(0, top));
  const piece = await sharp(editorPng, { limitInputPixels: false }).extract(crop).png().toBuffer();
  const page = await sharp({ create: { width, height, channels: 3, background: "#ffffff" } })
    .composite([{ input: piece, left: Math.max(0, left), top: Math.max(0, top) }])
    .png()
    .toBuffer();
  const a = await sharp(page, { limitInputPixels: false }).flatten({ background: "#ffffff" }).removeAlpha().raw().toBuffer();
  const b = await exp.raw().toBuffer();
  const diff = Buffer.alloc(width * height * 3, 255);
  let sum = 0;
  let different = 0;
  let print = 0;
  let differentInPrint = 0;
  for (let i = 0, p = 0; i < a.length; i += 3, p++) {
    const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
    sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    const inPrint = b[i] < 250 || b[i + 1] < 250 || b[i + 2] < 250;
    if (inPrint) print++;
    if (d > 48) {
      different++;
      if (inPrint) differentInPrint++;
      diff[i] = 255;
      diff[i + 1] = 255 - d;
      diff[i + 2] = 255 - d;
    }
  }
  if (sideBySide) {
    const row = (raw: Buffer) => sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
    const gap = 12;
    await sharp({ create: { width, height: height * 3 + gap * 2, channels: 3, background: "#808080" } })
      .composite([
        { input: await row(a), left: 0, top: 0 },
        { input: await row(b), left: 0, top: height + gap },
        { input: await row(diff), left: 0, top: (height + gap) * 2 },
      ])
      .png()
      .toFile(sideBySide);
  }
  const n = width * height;
  return { width, height, mean: sum / (n * 3), differentPct: (different / n) * 100, differentInPrintPct: print ? (differentInPrint / print) * 100 : 0, printPct: (print / n) * 100 };
}
