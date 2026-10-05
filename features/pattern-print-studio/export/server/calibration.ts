// The calibration test: a 10 × 10 in sheet with a ruler tick every inch and
// a 5 in square. Print it once and measure it with a real ruler — if the
// square is 5 in, every export at this DPI is at true size. Server only
// (the lettering is drawn as outlines from the bundled font).

import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseFont, type Font } from "opentype.js";
import type { ExportScene } from "../scene";

export const CALIBRATION_IN = 10;

let font: Promise<Font> | null = null;
function loadFont(): Promise<Font> {
  font ??= readFile(path.join(process.cwd(), "public", "pattern-print-studio", "fonts", "arimo-latin-700-normal.woff")).then((b) => parseFont(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer));
  font.catch(() => (font = null));
  return font;
}

const n = (v: number) => String(Math.round(v * 1e5) / 1e5);

/** The calibration sheet as an export scene (inches in, pixels out at `dpi`). */
export async function calibrationScene(docName: string, dpi: number): Promise<ExportScene> {
  const f = await loadFont();
  const S = CALIBRATION_IN;
  const px = Math.round(S * dpi);
  const text = (s: string, x: number, y: number, size: number, anchor: "start" | "middle" = "start") => {
    const w = f.getAdvanceWidth(s, size);
    return `<path d="${f.getPath(s, anchor === "middle" ? x - w / 2 : x, y, size).toPathData(5)}" fill="#000"/>`;
  };
  const parts: string[] = [`<rect width="${S}" height="${S}" fill="#fff"/>`];
  // A hairline frame exactly on the 10 in edge, drawn inside it so it is not cut off.
  const hair = 1.5 / dpi;
  parts.push(`<rect x="${n(hair / 2)}" y="${n(hair / 2)}" width="${n(S - hair)}" height="${n(S - hair)}" fill="none" stroke="#000" stroke-width="${n(hair)}"/>`);
  // Rulers along the top and the left: a long tick every inch, shorter ones at halves and quarters.
  for (let q = 0; q <= S * 4; q++) {
    const at = q / 4;
    const len = q % 4 === 0 ? 0.45 : q % 2 === 0 ? 0.28 : 0.16;
    const w = q % 4 === 0 ? 0.012 : 0.006;
    parts.push(`<rect x="${n(at - w / 2)}" y="0" width="${n(w)}" height="${n(len)}" fill="#000"/>`, `<rect x="0" y="${n(at - w / 2)}" width="${n(len)}" height="${n(w)}" fill="#000"/>`);
    if (q % 4 === 0 && at > 0 && at < S) parts.push(text(String(at), at + 0.05, 0.62, 0.2), text(String(at), 0.52, at + 0.24, 0.2));
  }
  // The 5 in square, centred: its OUTER edge is exactly 5 in.
  const line = 0.02;
  parts.push(`<rect x="${n(2.5 + line / 2)}" y="${n(2.5 + line / 2)}" width="${n(5 - line)}" height="${n(5 - line)}" fill="none" stroke="#000" stroke-width="${n(line)}"/>`);
  parts.push(text("5 in × 5 in", 5, 2.38, 0.22, "middle"), text("measure the outer edge of this square", 5, 7.78, 0.16, "middle"));
  parts.push(text(docName.slice(0, 40) || "Untitled", 5, 4.55, 0.3, "middle"), text(`${dpi} DPI`, 5, 5.2, 0.5, "middle"), text(`${px} × ${px} px  =  10 in × 10 in`, 5, 5.7, 0.2, "middle"), text("Calibration test — Pattern Print Studio", 5, 9.6, 0.16, "middle"));
  const inner = parts.join("");
  return {
    widthPx: px,
    heightPx: px,
    tiles: 0,
    warnings: [],
    svg(x0Px = 0, stripPx = px) {
      const sx = S / px;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${stripPx}" height="${px}" viewBox="${n(x0Px * sx)} 0 ${n(stripPx * sx)} ${S}" preserveAspectRatio="none">${inner}</svg>`;
    },
  };
}
