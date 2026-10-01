import type { RasterAsset } from "./types";

/** Longest side of the on-canvas display proxy. Deterministic, so a proxy
 * rebuilt after reload has the same pixel size the saved matrix expects. */
export const PROXY_MAX_PX = 2048;

export function newId(prefix = "o"): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("This image couldn't be decoded by the browser."));
    img.src = src;
  });
}

export function makeProxy(img: CanvasImageSource & { width: number; height: number }): HTMLCanvasElement {
  const w = (img as HTMLImageElement).naturalWidth || img.width;
  const h = (img as HTMLImageElement).naturalHeight || img.height;
  const scale = Math.min(1, PROXY_MAX_PX / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't supported in this browser.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Holds every raster's original + its display proxy for the open document. */
export class AssetStore {
  private assets = new Map<string, RasterAsset>();
  private proxies = new Map<string, HTMLCanvasElement>();

  get(id: string) {
    return this.assets.get(id);
  }
  getProxy(id: string) {
    return this.proxies.get(id) ?? null;
  }
  all(): RasterAsset[] {
    return [...this.assets.values()];
  }
  clear() {
    this.assets.clear();
    this.proxies.clear();
  }

  async add(asset: RasterAsset, decoded?: HTMLImageElement): Promise<HTMLCanvasElement> {
    const img = decoded ?? (await loadImageElement(asset.dataUrl));
    const proxy = makeProxy(img);
    this.assets.set(asset.id, asset);
    this.proxies.set(asset.id, proxy);
    return proxy;
  }

  async addAll(assets: RasterAsset[]) {
    await Promise.all(assets.map((a) => this.add(a)));
  }
}

// ---------------------------------------------------------------------------
// DPI detection (no dependencies). Returns null when the file doesn't say.

export async function detectDpi(file: Blob): Promise<number | null> {
  const head = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
  if (head.byteLength > 8 && head.getUint32(0) === 0x89504e47) return pngDpi(head);
  if (head.byteLength > 4 && head.getUint16(0) === 0xffd8) return jpegDpi(head);
  return null;
}

function pngDpi(v: DataView): number | null {
  let off = 8;
  while (off + 12 <= v.byteLength) {
    const len = v.getUint32(off);
    const type = String.fromCharCode(v.getUint8(off + 4), v.getUint8(off + 5), v.getUint8(off + 6), v.getUint8(off + 7));
    if (type === "pHYs" && off + 17 <= v.byteLength) {
      const ppuX = v.getUint32(off + 8);
      const unit = v.getUint8(off + 16); // 1 = metre
      return unit === 1 && ppuX > 0 ? round2(ppuX * 0.0254) : null;
    }
    if (type === "IDAT" || type === "IEND") return null;
    off += 12 + len;
  }
  return null;
}

function jpegDpi(v: DataView): number | null {
  let off = 2;
  let jfif: number | null = null;
  while (off + 4 <= v.byteLength) {
    if (v.getUint8(off) !== 0xff) break;
    const marker = v.getUint8(off + 1);
    const len = v.getUint16(off + 2);
    const start = off + 4;
    if (marker === 0xe0 && start + 12 <= v.byteLength && v.getUint32(start) === 0x4a464946) {
      // "JFIF\0" + version(2) + units(1) + Xdensity(2)
      const units = v.getUint8(start + 7);
      const xd = v.getUint16(start + 8);
      if (xd > 0 && units === 1) jfif = xd;
      else if (xd > 0 && units === 2) jfif = round2(xd * 2.54);
    }
    if (marker === 0xe1 && start + 6 <= v.byteLength && v.getUint32(start) === 0x45786966) {
      const exif = exifDpi(v, start + 6);
      if (exif) return exif; // EXIF wins over JFIF
    }
    if (marker === 0xda) break; // start of scan
    off += 2 + len;
  }
  return jfif;
}

function exifDpi(v: DataView, tiff: number): number | null {
  if (tiff + 8 > v.byteLength) return null;
  const little = v.getUint16(tiff) === 0x4949;
  const u16 = (o: number) => v.getUint16(o, little);
  const u32 = (o: number) => v.getUint32(o, little);
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > v.byteLength) return null;
  const count = u16(ifd);
  let xres: number | null = null;
  let unit = 2; // inches
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > v.byteLength) break;
    const tag = u16(e);
    if (tag === 0x011a) {
      const vo = tiff + u32(e + 8);
      if (vo + 8 <= v.byteLength) {
        const den = u32(vo + 4);
        xres = den ? u32(vo) / den : null;
      }
    } else if (tag === 0x0128) unit = u16(e + 8);
  }
  if (!xres) return null;
  return unit === 3 ? round2(xres * 2.54) : round2(xres);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
