// Request handlers for the export API. They hold no auth logic — the
// route files under app/api decide who may call them.

import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { DPI_MAX, DPI_MIN, PREVIEW_DPI, type ExportOptions, type Rect } from "../options";
import type { SceneDoc } from "../scene";
import { usedAssets } from "../scene";
import { assetPath, AssetUploadError, hasAsset, isHash, saveAsset } from "./asset-store";
import { ExportError, prepareScene, renderPng } from "./render";

const json = (body: unknown, status = 200) => Response.json(body, { status });

/** HEAD: does the server already have this original? */
export async function assetHead(hash: string): Promise<Response> {
  return new Response(null, { status: (await hasAsset(hash)) ? 200 : 404 });
}

/** PUT: store an original under its SHA-256. */
export async function assetPut(hash: string, request: Request): Promise<Response> {
  try {
    if (await hasAsset(hash)) return json({ ok: true, stored: false });
    const size = await saveAsset(hash, request.body);
    return json({ ok: true, stored: true, size });
  } catch (err) {
    if (err instanceof AssetUploadError) return json({ error: err.message }, err.status);
    return json({ error: "The image could not be stored on the server." }, 500);
  }
}

export interface ExportRequest {
  doc: SceneDoc;
  /** Asset id → SHA-256 of its original file (uploaded beforehand) and its file name. */
  assets: { id: string; hash: string; name: string }[];
  area: Rect;
  options: ExportOptions;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Checks the shape of an export request; returns a message if it is not usable. */
export function validateExportRequest(body: unknown): string | null {
  const b = body as Partial<ExportRequest> | null;
  if (!b || typeof b !== "object") return "Bad request.";
  if (!b.doc || !Array.isArray(b.doc.objects) || typeof b.doc.settings !== "object") return "The document is missing.";
  const a = b.area;
  if (!a || !isNum(a.x) || !isNum(a.y) || !isNum(a.w) || !isNum(a.h) || !(a.w > 0) || !(a.h > 0) || a.w > 2000 || a.h > 2000) return "The export area is not valid.";
  const o = b.options;
  if (!o || !isNum(o.dpi) || !isNum(o.cutLineWidthPt) || (o.background !== "white" && o.background !== "transparent")) return "The export options are not valid.";
  if (!Array.isArray(b.assets) || b.assets.some((x) => !x || typeof x.id !== "string" || !isHash(String(x.hash)))) return "The image list is not valid.";
  return null;
}

/** The assets a request needs that the server does not have yet. */
async function missingAssets(req: ExportRequest): Promise<string[]> {
  const byId = new Map(req.assets.map((a) => [a.id, a]));
  const missing: string[] = [];
  for (const id of usedAssets(req.doc)) {
    const a = byId.get(id);
    if (!a || !(await hasAsset(a.hash))) missing.push(id);
  }
  return missing;
}

export function renderInputOf(req: ExportRequest, dpi: number) {
  const byId = new Map(req.assets.map((a) => [a.id, a]));
  return {
    doc: req.doc,
    area: req.area,
    options: { ...req.options, dpi },
    originalPath: (id: string) => (byId.has(id) ? assetPath(byId.get(id)!.hash) : null),
    assetName: (id: string) => byId.get(id)?.name ?? id,
  };
}

/**
 * POST: a quick low-resolution picture of exactly what would be exported —
 * the same scene and the same rasteriser as the real export, at 20 DPI.
 */
export async function preview(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Bad request." }, 400);
  }
  const problem = validateExportRequest(body);
  if (problem) return json({ error: problem }, 400);
  const req = body as ExportRequest;
  if (req.options.dpi < DPI_MIN || req.options.dpi > DPI_MAX) return json({ error: `DPI must be between ${DPI_MIN} and ${DPI_MAX}.` }, 400);
  const missing = await missingAssets(req);
  if (missing.length) return json({ error: "Some original images have not been uploaded yet.", missing }, 409);
  try {
    const t0 = Date.now();
    // Keep the preview small even for a tiny area: 20 DPI, but at least ~600 px on the long side (never above the export itself).
    const longest = Math.max(req.area.w, req.area.h);
    const dpi = Math.min(req.options.dpi, Math.max(PREVIEW_DPI, Math.min(96, 600 / longest)));
    const scene = await prepareScene(renderInputOf(req, dpi));
    const png = await renderPng(scene);
    return json({ image: `data:image/png;base64,${png.toString("base64")}`, width: scene.widthPx, height: scene.heightPx, dpi, tiles: scene.tiles, warnings: scene.warnings, ms: Date.now() - t0 });
  } catch (err) {
    if (err instanceof ExportError) return json({ error: err.message }, 422);
    return json({ error: "The preview could not be rendered." }, 500);
  }
}

// ---------------------------------------------------------------- export jobs
// (imported lazily: jobs.ts imports this file for request validation)
const jobsModule = () => import("./jobs");

const fail = async (err: unknown) => {
  const { JobError } = await jobsModule();
  if (err instanceof JobError) return json({ error: err.message, ...err.extra }, err.status);
  return json({ error: "The export service had a problem. Please try again." }, 500);
};

/** GET: the last 20 exports of a document. */
export async function jobsList(api: string, userId: string, request: Request): Promise<Response> {
  try {
    const { listJobs } = await jobsModule();
    return json({ jobs: await listJobs(api, userId, new URL(request.url).searchParams.get("doc") ?? "") });
  } catch (err) {
    return fail(err);
  }
}

/** POST: start an export (or a calibration test) as a background job. */
export async function jobsCreate(api: string, userId: string, request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Bad request." }, 400);
  }
  try {
    const { createJob } = await jobsModule();
    return json({ job: await createJob(api, userId, body as Parameters<typeof createJob>[2]) }, 202);
  } catch (err) {
    return fail(err);
  }
}

/** POST cancel / retry, GET link (a fresh signed download link). */
export async function jobAction(api: string, userId: string, id: string, action: string, request: Request): Promise<Response> {
  const docId = new URL(request.url).searchParams.get("doc") ?? "";
  try {
    const jobs = await jobsModule();
    if (action === "cancel") {
      const job = await jobs.cancelJob(api, userId, docId, id);
      return job ? json({ job }) : json({ error: "Export not found." }, 404);
    }
    if (action === "retry") return json({ job: await jobs.retryJob(api, userId, docId, id) }, 202);
    if (action === "link") {
      const job = await jobs.getJob(api, userId, docId, id);
      return job?.download ? json({ download: job.download }) : json({ error: "This export has no file to download." }, 404);
    }
    return json({ error: "Not found." }, 404);
  } catch (err) {
    return fail(err);
  }
}

/** GET: the finished file, for anyone holding a valid, unexpired signed link. */
export async function jobDownload(id: string, request: Request): Promise<Response> {
  const { resolveDownload } = await jobsModule();
  const found = await resolveDownload(id, new URL(request.url).searchParams);
  if (!found) return json({ error: "This download link is not valid any more. Ask for a new link in the export list." }, 403);
  return new Response(Readable.toWeb(createReadStream(found.file)) as ReadableStream, {
    headers: { "Content-Type": found.contentType, "Content-Length": String(found.bytes), "Content-Disposition": `attachment; filename="${found.fileName}"`, "Cache-Control": "private, no-store" },
  });
}
