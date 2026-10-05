// Request handlers for the export API. They hold no auth logic — the
// route files under app/api decide who may call them.

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
