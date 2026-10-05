// Browser side of the export API: uploads each original image once (by its
// SHA-256) and asks the server for a preview.

import type { RasterAsset } from "../engine/types";
import type { ExportOptions, Rect } from "./options";
import type { SceneDoc } from "./scene";

export const DEFAULT_EXPORT_API = "/api/pattern-print-studio/export";

export interface PreviewResult {
  image: string;
  width: number;
  height: number;
  dpi: number;
  tiles: number;
  warnings: string[];
  ms: number;
}

/** asset id → SHA-256 of its original bytes (worked out once per image). */
const hashes = new Map<string, string>();

async function originalBytes(asset: RasterAsset): Promise<Blob> {
  if (!asset.dataUrl) throw new Error(`The original image "${asset.name}" is missing from this document. Import it again.`);
  return (await fetch(asset.dataUrl)).blob();
}

async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function message(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error || fallback;
  } catch {
    return res.status === 401 ? "Please sign in again." : fallback;
  }
}

/** Makes sure the server has every original this export uses. Returns the id → hash list to send with the request. */
export async function uploadOriginals(api: string, assets: RasterAsset[], used: string[], onProgress?: (done: number, total: number) => void): Promise<{ id: string; hash: string; name: string }[]> {
  const list = assets.filter((a) => used.includes(a.id));
  const out: { id: string; hash: string; name: string }[] = [];
  let done = 0;
  for (const asset of list) {
    let blob: Blob | null = null;
    let hash = hashes.get(asset.id);
    if (!hash) {
      blob = await originalBytes(asset);
      hash = await sha256(blob);
      hashes.set(asset.id, hash);
    }
    const head = await fetch(`${api}/assets/${hash}`, { method: "HEAD" });
    if (head.status === 401) throw new Error("Please sign in again.");
    if (!head.ok) {
      blob ??= await originalBytes(asset);
      const put = await fetch(`${api}/assets/${hash}`, { method: "PUT", body: blob, headers: { "Content-Type": "application/octet-stream" } });
      if (!put.ok) throw new Error(await message(put, `"${asset.name}" could not be uploaded.`));
    }
    out.push({ id: asset.id, hash, name: asset.name });
    onProgress?.(++done, list.length);
  }
  return out;
}

export async function requestPreview(api: string, body: { doc: SceneDoc; assets: { id: string; hash: string; name: string }[]; area: Rect; options: ExportOptions }, signal?: AbortSignal): Promise<PreviewResult> {
  const res = await fetch(`${api}/preview`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  if (!res.ok) throw new Error(await message(res, "The preview could not be made."));
  return (await res.json()) as PreviewResult;
}

export interface TiffDownload {
  blob: Blob;
  fileName: string;
  info: { width: number; height: number; dpi: number; bytes: number; strips: number; tiles: number; warnings: string[]; ms: number };
}

/** A low-resolution TIFF made straight away by the export renderer (step 4B; full-size exports are background jobs). */
export async function requestTiff(api: string, body: { doc: SceneDoc; assets: { id: string; hash: string; name: string }[]; area: Rect; options: ExportOptions; fileName: string }, signal?: AbortSignal): Promise<TiffDownload> {
  const res = await fetch(`${api}/tiff`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  if (!res.ok) throw new Error(await message(res, "The export could not be made."));
  return { blob: await res.blob(), fileName: body.fileName, info: JSON.parse(res.headers.get("X-Pps-Export") ?? "{}") };
}

/** Hands a file to the browser's download. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
