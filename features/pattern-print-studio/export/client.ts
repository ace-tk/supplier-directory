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

// ---------------------------------------------------------------- export jobs
export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";

/** One export in the list (mirrors the server's JobView). */
export interface ExportJob {
  id: string;
  docId: string;
  kind: "export" | "calibration";
  format: "tiff" | "pdf";
  fileName: string;
  area: string;
  dpi: number;
  widthPx: number;
  heightPx: number;
  widthIn: number;
  heightIn: number;
  status: JobStatus;
  step: "waiting" | "preparing" | "rendering" | "stitching" | "compressing" | "saving" | "done";
  progress: number;
  createdAt: number;
  finishedAt?: number;
  bytes?: number;
  seconds?: number;
  peakMemoryMb?: number;
  error?: string;
  download?: { url: string; expiresAt: number };
}

export const isActive = (j: ExportJob) => j.status === "queued" || j.status === "running";

export const STEP_LABEL: Record<ExportJob["step"], string> = { waiting: "Waiting in line", preparing: "Preparing images", rendering: "Rendering", stitching: "Stitching", compressing: "Compressing", saving: "Saving", done: "Done" };

async function call<T>(url: string, init: RequestInit | undefined, fallback: string): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(await message(res, fallback));
  return (await res.json()) as T;
}
const post = (body?: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

export const listExports = async (api: string, docId: string) => (await call<{ jobs: ExportJob[] }>(`${api}/jobs?doc=${encodeURIComponent(docId)}`, undefined, "The export list could not be loaded.")).jobs;

/** Starts a full-size export as a background job. */
export const startExport = async (api: string, body: { docId: string; areaLabel: string; request: { doc: SceneDoc; assets: { id: string; hash: string; name: string }[]; area: Rect; options: ExportOptions } }) =>
  (await call<{ job: ExportJob }>(`${api}/jobs`, post({ kind: "export", ...body }), "The export could not be started.")).job;

/** Starts the 10 × 10 in calibration test. */
export const startCalibration = async (api: string, body: { docId: string; docName: string; dpi: number }) => (await call<{ job: ExportJob }>(`${api}/jobs`, post({ kind: "calibration", ...body }), "The calibration test could not be started.")).job;

export const cancelExport = (api: string, job: ExportJob) => call<{ job: ExportJob }>(`${api}/jobs/${job.id}/cancel?doc=${encodeURIComponent(job.docId)}`, post(), "The export could not be cancelled.");
export const retryExport = async (api: string, job: ExportJob) => (await call<{ job: ExportJob }>(`${api}/jobs/${job.id}/retry?doc=${encodeURIComponent(job.docId)}`, post(), "The export could not be retried.")).job;
/** A fresh signed download link (the old one may have expired). */
export const freshLink = async (api: string, job: ExportJob) => (await call<{ download: { url: string; expiresAt: number } }>(`${api}/jobs/${job.id}/link?doc=${encodeURIComponent(job.docId)}`, undefined, "A new download link could not be made.")).download;

/** Opens a download in the browser without leaving the page. */
export function openDownload(url: string, fileName: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

