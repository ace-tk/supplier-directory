import { detectDpi, fileToDataUrl, loadImageElement, newId } from "./assets";
import type { RasterAsset } from "./types";

export interface ParsedRasterImport {
  kind: "raster";
  fileName: string;
  asset: Omit<RasterAsset, "dpi">;
  img: HTMLImageElement;
  /** DPI stored in the file, or null if the file doesn't say. */
  detectedDpi: number | null;
}

/** PNG/JPG (and TIFF where the browser can decode it, e.g. Safari). */
export async function parseRaster(file: File): Promise<ParsedRasterImport> {
  const dataUrl = await fileToDataUrl(file);
  let img: HTMLImageElement;
  try {
    img = await loadImageElement(dataUrl);
  } catch {
    if (/\.tiff?$/i.test(file.name) || file.type === "image/tiff") {
      throw new Error("This browser can't decode TIFF files. TIFF support needs a TIFF decoder library (pending your approval) — for now, export the print as PNG.");
    }
    throw new Error("This image couldn't be decoded.");
  }
  return {
    kind: "raster",
    fileName: file.name,
    asset: {
      id: newId("a"),
      name: file.name,
      mime: file.type || "image/png",
      dataUrl,
      pxWidth: img.naturalWidth,
      pxHeight: img.naturalHeight,
    },
    img,
    detectedDpi: await detectDpi(file),
  };
}
