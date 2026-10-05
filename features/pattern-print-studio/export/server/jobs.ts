// Export jobs: a full-size export runs in the background on the server
// while the user keeps working. Each job is a folder on the server's disk
// (its record, the request it was made from, and the finished file), so the
// export list survives a page reload. Server only.
//
// One job renders at a time; the rest wait in line. Cancelling takes effect
// between strips (a few seconds at most at 150 DPI, longer at 300).

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { AUTH_SECRET } from "@/lib/auth-secret";
import { DPI_MAX, DPI_MIN, exportFileName, pixelSize, safeNamePart } from "../options";
import { usedAssets } from "../scene";
import { EXPORT_ROOT, hasAsset } from "./asset-store";
import { calibrationScene, CALIBRATION_IN } from "./calibration";
import { renderInputOf, validateExportRequest, type ExportRequest } from "./handlers";
import { ExportError, prepareScene, renderTiff, type ExportStep } from "./render";

export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";
export type JobStep = "waiting" | "preparing" | ExportStep | "saving" | "done";

export interface JobRecord {
  id: string;
  docId: string;
  kind: "export" | "calibration";
  format: "tiff" | "pdf";
  fileName: string;
  /** "All-sizes", "XL", "Selection", "Calibration". */
  area: string;
  dpi: number;
  widthPx: number;
  heightPx: number;
  /** The export area, inches. */
  widthIn: number;
  heightIn: number;
  status: JobStatus;
  step: JobStep;
  /** 0–1. */
  progress: number;
  createdAt: number;
  finishedAt?: number;
  /** Size of the finished file, bytes. */
  bytes?: number;
  seconds?: number;
  /** Most memory the server process held while this job ran, MB. */
  peakMemoryMb?: number;
  error?: string;
}

/** What the browser gets: the record plus, for a finished job, a signed download link that expires. */
export interface JobView extends JobRecord {
  download?: { url: string; expiresAt: number };
}

export const MAX_JOBS_PER_DOC = 20;
/** Finished files are kept this long. */
const KEEP_MS = 7 * 24 * 3600 * 1000;
/** A download link works for this long; a new one can be asked for at any time. */
export const LINK_MS = 60 * 60 * 1000;
/** Jobs are drawn in narrower strips than the limit, for a smoother progress bar and quicker cancelling. */
const JOB_STRIP_PX = 4096;

const isId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{6,64}$/.test(v);
const userKey = (userId: string) => safeNamePart(userId, "user").slice(0, 64);
const docDir = (userId: string, docId: string) => path.join(EXPORT_ROOT, "jobs", userKey(userId), docId);
const jobDir = (userId: string, docId: string, id: string) => path.join(docDir(userId, docId), id);
const outputPath = (userId: string, job: Pick<JobRecord, "docId" | "id" | "format">) => path.join(jobDir(userId, job.docId, job.id), job.format === "pdf" ? "output.pdf" : "output.tif");

// Shared by every route handler in this server process (route bundles may each load this module).
interface Shared {
  active: Map<string, AbortController>;
  line: Promise<void>;
  /** Time stamp of the newest job, so two jobs never share one (the list is ordered by it). */
  stamp: number;
}
const shared = ((globalThis as { __ppsExportJobs?: Shared }).__ppsExportJobs ??= { active: new Map(), line: Promise.resolve(), stamp: 0 });

export class JobError extends Error {
  constructor(
    message: string,
    public status = 400,
    public extra: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

async function readJob(dir: string): Promise<JobRecord | null> {
  try {
    return JSON.parse(await readFile(path.join(dir, "job.json"), "utf8")) as JobRecord;
  } catch {
    return null;
  }
}
/** Written to a side file and renamed into place, so a reader never sees a half-written record. */
async function writeJob(userId: string, job: JobRecord) {
  const file = path.join(jobDir(userId, job.docId, job.id), "job.json");
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  await writeFile(tmp, JSON.stringify(job));
  await rename(tmp, file);
}

// ---------------------------------------------------------------- signed, expiring download links
function sign(userId: string, docId: string, id: string, exp: number): string {
  return createHmac("sha256", AUTH_SECRET).update(`pps-export:${userKey(userId)}:${docId}:${id}:${exp}`).digest("base64url");
}
function linkFor(api: string, userId: string, job: JobRecord): { url: string; expiresAt: number } {
  const exp = Date.now() + LINK_MS;
  const q = new URLSearchParams({ doc: job.docId, u: userKey(userId), exp: String(exp), sig: sign(userId, job.docId, job.id, exp) });
  return { url: `${api}/jobs/${job.id}/download?${q}`, expiresAt: exp };
}
/** Checks a download link. Returns the file and its name, or null if the link is wrong or has expired. */
export async function resolveDownload(id: string, params: URLSearchParams): Promise<{ file: string; fileName: string; bytes: number; contentType: string } | null> {
  const docId = params.get("doc");
  const user = params.get("u") ?? "";
  const exp = Number(params.get("exp"));
  const sig = params.get("sig") ?? "";
  if (!isId(id) || !isId(docId) || !user || !Number.isFinite(exp) || exp < Date.now()) return null;
  const want = Buffer.from(sign(user, docId, id, exp));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const job = await readJob(jobDir(user, docId, id));
  if (!job || job.status !== "done") return null;
  const file = outputPath(user, job);
  try {
    return { file, fileName: job.fileName, bytes: (await stat(file)).size, contentType: job.format === "pdf" ? "application/pdf" : "image/tiff" };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- list
const view = (api: string, userId: string, job: JobRecord): JobView => (job.status === "done" ? { ...job, download: linkFor(api, userId, job) } : job);

/** The last 20 exports of a document, newest first. Old finished files are removed on the way. */
export async function listJobs(api: string, userId: string, docId: string): Promise<JobView[]> {
  if (!isId(docId)) throw new JobError("Bad document id.");
  let names: string[] = [];
  try {
    names = await readdir(docDir(userId, docId));
  } catch {
    return [];
  }
  const jobs: JobRecord[] = [];
  for (const name of names) {
    const job = await readJob(path.join(docDir(userId, docId), name));
    if (!job) continue;
    // A job that was running when the server stopped can never finish.
    if ((job.status === "running" || job.status === "queued") && !shared.active.has(job.id)) {
      Object.assign(job, { status: "failed", step: "done", error: "The server restarted during this export. Press Retry.", finishedAt: Date.now() } satisfies Partial<JobRecord>);
      await writeJob(userId, job).catch(() => undefined);
    }
    jobs.push(job);
  }
  jobs.sort((a, b) => b.createdAt - a.createdAt);
  const keep: JobRecord[] = [];
  for (const [i, job] of jobs.entries()) {
    const busy = shared.active.has(job.id);
    if (!busy && (i >= MAX_JOBS_PER_DOC || Date.now() - job.createdAt > KEEP_MS)) await rm(jobDir(userId, docId, job.id), { recursive: true, force: true });
    else keep.push(job);
  }
  return keep.map((j) => view(api, userId, j));
}

export async function getJob(api: string, userId: string, docId: string, id: string): Promise<JobView | null> {
  if (!isId(docId) || !isId(id)) return null;
  const job = await readJob(jobDir(userId, docId, id));
  return job ? view(api, userId, job) : null;
}

// ---------------------------------------------------------------- create + run
export interface CreateJobBody {
  kind?: "export" | "calibration";
  docId: string;
  docName?: string;
  areaLabel?: string;
  dpi?: number;
  request?: ExportRequest;
}

export async function createJob(api: string, userId: string, body: CreateJobBody): Promise<JobView> {
  if (!body || !isId(body.docId)) throw new JobError("Bad document id.");
  const kind = body.kind === "calibration" ? "calibration" : "export";
  let record: Omit<JobRecord, "id" | "status" | "step" | "progress" | "createdAt">;
  if (kind === "calibration") {
    const dpi = Number(body.dpi);
    if (!Number.isInteger(dpi) || dpi < DPI_MIN || dpi > DPI_MAX) throw new JobError(`DPI must be a whole number between ${DPI_MIN} and ${DPI_MAX}.`);
    const px = Math.round(CALIBRATION_IN * dpi);
    record = { docId: body.docId, kind, format: "tiff", fileName: exportFileName(body.docName ?? "Untitled", "Calibration", dpi, new Date(), "tiff"), area: "Calibration", dpi, widthPx: px, heightPx: px, widthIn: CALIBRATION_IN, heightIn: CALIBRATION_IN };
  } else {
    const problem = validateExportRequest(body.request);
    if (problem) throw new JobError(problem);
    const req = body.request as ExportRequest;
    const dpi = req.options.dpi;
    if (!Number.isInteger(dpi) || dpi < DPI_MIN || dpi > DPI_MAX) throw new JobError(`DPI must be a whole number between ${DPI_MIN} and ${DPI_MAX}.`);
    const format = req.options.format === "pdf" ? "pdf" : "tiff";
    const byId = new Map(req.assets.map((a) => [a.id, a]));
    const missing: string[] = [];
    for (const id of usedAssets(req.doc)) if (!byId.has(id) || !(await hasAsset(byId.get(id)!.hash))) missing.push(id);
    if (missing.length) throw new JobError("Some original images have not been uploaded yet.", 409, { missing });
    // A PDF is vector: it has no pixel size of its own.
    const px = format === "pdf" ? { width: 0, height: 0 } : pixelSize(req.area, dpi);
    const area = safeNamePart(body.areaLabel ?? "Area", "Area");
    record = { docId: body.docId, kind, format, fileName: exportFileName(req.doc.name, area, dpi, new Date(), format), area, dpi, widthPx: px.width, heightPx: px.height, widthIn: req.area.w, heightIn: req.area.h };
  }
  const job: JobRecord = { ...record, id: randomUUID(), status: "queued", step: "waiting", progress: 0, createdAt: (shared.stamp = Math.max(Date.now(), shared.stamp + 1)) };
  // Marked as live BEFORE its record is written: a list request arriving in between must not take it for a job
  // left over from a server restart.
  const control = new AbortController();
  shared.active.set(job.id, control);
  try {
    await mkdir(jobDir(userId, job.docId, job.id), { recursive: true });
    await writeFile(path.join(jobDir(userId, job.docId, job.id), "request.json"), JSON.stringify({ ...body, kind }));
    await writeJob(userId, job);
  } catch (err) {
    shared.active.delete(job.id);
    throw err;
  }
  const created = { ...job };
  shared.line = shared.line.then(() => run(userId, job, { ...body, kind }, control)).catch(() => undefined);
  return created;
}

async function run(userId: string, job: JobRecord, body: CreateJobBody, control: AbortController) {
  const started = Date.now();
  let peak = process.memoryUsage().rss;
  const watch = setInterval(() => (peak = Math.max(peak, process.memoryUsage().rss)), 200);
  let lastWrite = 0;
  const update = async (patch: Partial<JobRecord>, force = false) => {
    Object.assign(job, patch);
    // Progress is written at most a few times a second.
    if (force || Date.now() - lastWrite > 300) {
      lastWrite = Date.now();
      await writeJob(userId, job).catch(() => undefined);
    }
  };
  // Strips report their own progress. A stage with no finer signal (a one-strip picture, or joining + compressing)
  // creeps forward on a clock instead, from where it started towards `to`.
  let creep: ReturnType<typeof setInterval> | null = null;
  const megapixels = (job.widthPx * job.heightPx) / 1e6;
  const creepTo = (to: number, expectedSeconds: number) => {
    if (creep) clearInterval(creep);
    const from = job.progress;
    const t0 = Date.now();
    creep = setInterval(() => void update({ progress: Math.min(to, from + (to - from) * ((Date.now() - t0) / (Math.max(2, expectedSeconds) * 1000))) }), 400);
  };
  const single = job.widthPx <= JOB_STRIP_PX;
  const onProgress = (step: ExportStep, fraction: number) => {
    if (step === "rendering") {
      void update({ step, progress: Math.max(job.progress, 0.03 + 0.67 * fraction) }, fraction === 0);
      if (single && !creep) creepTo(0.97, megapixels * 0.45);
    } else {
      void update({ step, progress: Math.max(job.progress, 0.7) }, true);
      creepTo(0.97, megapixels * 0.12);
    }
  };
  try {
    if (control.signal.aborted) throw new ExportError("The export was cancelled.");
    await update({ status: "running", step: "preparing", progress: 0.01 }, true);
    let out: { file: string; bytes: number };
    if (job.format === "pdf") {
      const { renderPdf } = await import("./pdf");
      out = await renderPdf(renderInputOf(body.request as ExportRequest, job.dpi), outputPath(userId, job), {
        signal: control.signal,
        // Embedding the images is the slow part; writing the vector page and saving are quick.
        onProgress: (step, fraction) => void update({ step, progress: Math.max(job.progress, step === "preparing" ? 0.02 + 0.6 * fraction : step === "rendering" ? 0.62 + 0.28 * fraction : 0.92) }, fraction === 0),
      });
    } else {
      const scene = job.kind === "calibration" ? await calibrationScene(body.docName ?? "Untitled", job.dpi) : await prepareScene(renderInputOf(body.request as ExportRequest, job.dpi));
      const transparent = job.kind === "export" && (body.request as ExportRequest).options.background === "transparent";
      out = await renderTiff(scene, outputPath(userId, job), { dpi: job.dpi, transparent, onProgress, signal: control.signal, stripPx: JOB_STRIP_PX });
    }
    if (control.signal.aborted) {
      await rm(out.file, { force: true });
      throw new ExportError("The export was cancelled.");
    }
    await update({ status: "done", step: "done", progress: 1, bytes: out.bytes, finishedAt: Date.now(), seconds: (Date.now() - started) / 1000, peakMemoryMb: Math.round(peak / 1048576) }, true);
  } catch (err) {
    const cancelled = control.signal.aborted;
    const reason = err instanceof ExportError ? err.message : "The export failed while rendering. Press Retry; if it fails again, try a lower DPI.";
    await update({ status: cancelled ? "cancelled" : "failed", step: "done", error: cancelled ? "Cancelled." : reason, finishedAt: Date.now(), seconds: (Date.now() - started) / 1000 }, true);
  } finally {
    clearInterval(watch);
    if (creep) clearInterval(creep);
    shared.active.delete(job.id);
  }
}

/** Stops a job. A waiting job is dropped at once; a running one stops at the next strip. */
export async function cancelJob(api: string, userId: string, docId: string, id: string): Promise<JobView | null> {
  if (!isId(docId) || !isId(id)) return null;
  const job = await readJob(jobDir(userId, docId, id));
  if (!job) return null;
  shared.active.get(id)?.abort();
  return view(api, userId, job);
}

/** Runs a failed or cancelled job again, from the request it was made with. */
export async function retryJob(api: string, userId: string, docId: string, id: string): Promise<JobView> {
  if (!isId(docId) || !isId(id)) throw new JobError("Bad export id.");
  let body: CreateJobBody;
  try {
    body = JSON.parse(await readFile(path.join(jobDir(userId, docId, id), "request.json"), "utf8")) as CreateJobBody;
  } catch {
    throw new JobError("This export can no longer be retried. Start it again from the Export dialog.", 404);
  }
  const next = await createJob(api, userId, body);
  await rm(jobDir(userId, docId, id), { recursive: true, force: true });
  return next;
}
