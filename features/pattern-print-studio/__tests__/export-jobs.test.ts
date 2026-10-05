import { createHash } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { defaultRepeat } from "../engine/repeat";
import type { PathNode, SceneNode, Seg } from "../engine/serialize";
import type { ExportOptions } from "../export/options";
import type { SceneDoc } from "../export/scene";
import { EXPORT_ROOT, hasAsset, saveAsset } from "../export/server/asset-store";
import { calibrationScene } from "../export/server/calibration";
import { cancelJob, createJob, getJob, JobError, listJobs, MAX_JOBS_PER_DOC, resolveDownload, retryJob, type JobView } from "../export/server/jobs";
import { renderTiff } from "../export/server/render";
import { verifyTiff } from "../export/verify-tiff.mjs";

const API = "/api/test";
const USER = `vitest-${process.pid}-${Date.now()}`;
const FIXTURE = path.join(__dirname, "fixtures", "repeat-tile.png");
const OPTS: ExportOptions = { format: "tiff", dpi: 72, mirror: false, cutLines: false, cutLineWidthPt: 1, sizeLabels: false, background: "white", pdfDownsample: true, pdfLiveText: false };
const AREA = { x: 0, y: 0, w: 12, h: 8 };

afterAll(() => rm(path.join(EXPORT_ROOT, "jobs", USER), { recursive: true, force: true }));

const rect = (x: number, y: number, w: number, h: number): PathNode => ({ t: "path", closed: true, segs: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py]) => [px, py, 0, 0, 0, 0] as Seg), style: { stroke: "#000000", strokeWidth: 0.01 } });
function doc(assetId = "tile"): SceneDoc {
  const tile: SceneNode = { t: "raster", assetId, matrix: [1 / 400, 0, 0, 1 / 400, 3, 4], width: 400, height: 400 };
  return { name: "Job Sample", settings: { bleed: { amount: 0.25, visible: true }, cutLines: { visible: true, color: "#000000", width: 0.5 / 72 } }, objects: [{ t: "powerclip", pc: { lock: true, repeat: defaultRepeat(1, 1) }, frame: rect(1, 1, 10, 6), contents: [tile], tile: [2.5, 3.5, 1, 1] }] };
}

/** Puts bytes in the server's asset store under their SHA-256, as the browser's upload does. */
async function upload(bytes: Buffer): Promise<string> {
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (!(await hasAsset(hash))) await saveAsset(hash, new Blob([new Uint8Array(bytes)]).stream());
  return hash;
}
const request = (hash: string, options: Partial<ExportOptions> = {}, name = "repeat-tile.png") => ({ doc: doc(), assets: [{ id: "tile", hash, name }], area: AREA, options: { ...OPTS, ...options } });

async function finished(docId: string, id: string, timeoutMs = 60000): Promise<JobView> {
  const t0 = Date.now();
  for (;;) {
    const job = await getJob(API, USER, docId, id);
    if (job && job.status !== "queued" && job.status !== "running") return job;
    if (Date.now() - t0 > timeoutMs) throw new Error("job did not finish");
    await new Promise((r) => setTimeout(r, 40));
  }
}

describe("calibration test sheet", () => {
  it("is exactly 10 × 10 in, with a 5 in square and a tick every inch", async () => {
    const file = path.join(os.tmpdir(), `pps-calibration-${process.pid}.tif`);
    try {
      const dpi = 100;
      const out = await renderTiff(await calibrationScene("Leggings Floral", dpi), file, { dpi, transparent: false });
      expect([out.width, out.height]).toEqual([1000, 1000]);
      expect((await verifyTiff(file, { widthIn: 10, heightIn: 10, dpi })).ok).toBe(true);
      const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
      const dark = (xIn: number, yIn: number) => data[(Math.min(999, Math.round(yIn * dpi)) * info.width + Math.min(999, Math.round(xIn * dpi))) * 3] < 128;
      // the square's line lies just INSIDE 2.5 in and 7.5 in (its outer edge is the 5 in measure)
      for (const [x, y] of [[2.51, 5], [7.49, 5], [5, 2.51], [5, 7.49]]) expect(dark(x, y)).toBe(true);
      for (const [x, y] of [[2.47, 5], [7.53, 5], [5, 2.47], [5, 7.53], [3.2, 3.2]]) expect(dark(x, y)).toBe(false);
      // the distance between the outer edges, measured in pixels along the middle row, is 5 in
      const row = 500 * info.width * 3;
      let first = -1;
      let last = -1;
      for (let x = 150; x < 850; x++) {
        if (data[row + x * 3] >= 128) continue;
        if (first < 0) first = x;
        last = x;
      }
      expect((last - first + 1) / dpi).toBeCloseTo(5, 1);
      // inch ticks along the top edge at 1…9 in, and none halfway to the quarter marks
      for (let i = 1; i < 10; i++) expect(dark(i, 0.3)).toBe(true);
      expect(dark(1.12, 0.3)).toBe(false);
    } finally {
      await rm(file, { force: true });
    }
  });
});

describe("export jobs", () => {
  it("runs in the background and ends with a verified TIFF, its size, time and peak memory", async () => {
    const hash = await upload(await readFile(FIXTURE));
    const started = await createJob(API, USER, { docId: "doc-run-1", areaLabel: "All-sizes", request: request(hash) });
    expect(started.status).toBe("queued");
    expect(started.fileName).toMatch(/^Job-Sample_All-sizes_72dpi_\d{4}-\d\d-\d\d_\d{4}\.tif$/);
    expect([started.widthPx, started.heightPx]).toEqual([864, 576]);
    const job = await finished("doc-run-1", started.id);
    expect(job.status).toBe("done");
    expect(job.progress).toBe(1);
    expect(job.bytes).toBeGreaterThan(1000);
    expect(job.seconds).toBeGreaterThan(0);
    expect(job.peakMemoryMb).toBeGreaterThan(10);
    expect(job.download?.url).toContain(`${API}/jobs/${job.id}/download?`);

    // the signed link gives the file; a changed or expired link does not
    const url = new URL(job.download!.url, "http://x");
    const found = await resolveDownload(job.id, url.searchParams);
    expect(found?.fileName).toBe(job.fileName);
    expect(found?.bytes).toBe(job.bytes);
    expect((await verifyTiff(found!.file, { widthIn: 12, heightIn: 8, dpi: 72 })).ok).toBe(true);
    const tampered = new URLSearchParams(url.searchParams);
    tampered.set("exp", String(Number(tampered.get("exp")) + 60_000));
    expect(await resolveDownload(job.id, tampered)).toBeNull();
    const wrongSig = new URLSearchParams(url.searchParams);
    wrongSig.set("sig", "x".repeat(43));
    expect(await resolveDownload(job.id, wrongSig)).toBeNull();
    const old = new URLSearchParams(url.searchParams);
    old.set("exp", String(Date.now() - 1000));
    expect(await resolveDownload(job.id, old)).toBeNull();
    const otherJob = await resolveDownload("another-job-id", url.searchParams);
    expect(otherJob).toBeNull();
    // a link can be made again on request, and it is a different one
    const again = await getJob(API, USER, "doc-run-1", job.id);
    expect(again?.download?.expiresAt).toBeGreaterThanOrEqual(job.download!.expiresAt);
  });

  it("a missing upload is refused up front; a corrupt original fails fast with the file's name; Retry runs it again", async () => {
    await expect(createJob(API, USER, { docId: "doc-fail-1", request: request("b".repeat(64)) })).rejects.toMatchObject({ status: 409, extra: { missing: ["tile"] } });
    const bad = await upload(Buffer.from(`not an image ${Date.now()}`));
    const started = await createJob(API, USER, { docId: "doc-fail-1", request: request(bad, {}, "broken-print.png") });
    const job = await finished("doc-fail-1", started.id);
    expect(job.status).toBe("failed");
    expect(job.error).toMatch(/broken-print\.png/);
    expect(job.error).toMatch(/could not be read/);
    expect(job.seconds).toBeLessThan(5);
    expect(job.download).toBeUndefined();

    const retried = await retryJob(API, USER, "doc-fail-1", job.id);
    expect(retried.id).not.toBe(job.id);
    expect((await finished("doc-fail-1", retried.id)).status).toBe("failed");
    // the retried job replaces the failed one in the list
    const list = await listJobs(API, USER, "doc-fail-1");
    expect(list.map((j) => j.id)).toEqual([retried.id]);
  });

  it("a job can be cancelled; no file is left behind", async () => {
    const hash = await upload(await readFile(FIXTURE));
    // 600 DPI: 7200 × 4800 px, drawn in two strips — long enough to cancel on the way
    const started = await createJob(API, USER, { docId: "doc-cancel-1", request: request(hash, { dpi: 600 }) });
    await cancelJob(API, USER, "doc-cancel-1", started.id);
    const job = await finished("doc-cancel-1", started.id);
    expect(job.status).toBe("cancelled");
    expect(job.download).toBeUndefined();
    const url = new URLSearchParams({ doc: "doc-cancel-1", u: USER, exp: String(Date.now() + 1000), sig: "x" });
    expect(await resolveDownload(job.id, url)).toBeNull();
    // and it can be run again
    const retried = await retryJob(API, USER, "doc-cancel-1", job.id);
    await cancelJob(API, USER, "doc-cancel-1", retried.id);
    expect((await finished("doc-cancel-1", retried.id)).status).toBe("cancelled");
  });

  it("bad requests are refused with a reason", async () => {
    const hash = await upload(await readFile(FIXTURE));
    await expect(createJob(API, USER, { docId: "../etc", request: request(hash) })).rejects.toBeInstanceOf(JobError);
    await expect(createJob(API, USER, { docId: "doc-bad-1", request: request(hash, { dpi: 20 }) })).rejects.toThrow(/between 72 and 600/);
    await expect(createJob(API, USER, { docId: "doc-bad-1", kind: "calibration", dpi: 5000 })).rejects.toThrow(/between 72 and 600/);
    await expect(listJobs(API, USER, "x")).rejects.toBeInstanceOf(JobError);
  });

  it("the list keeps the last 20 exports of a document, newest first; another document has its own list", async () => {
    const ids: string[] = [];
    for (let i = 0; i < MAX_JOBS_PER_DOC + 3; i++) ids.push((await createJob(API, USER, { docId: "doc-list-1", kind: "calibration", docName: "List", dpi: 72 })).id);
    await finished("doc-list-1", ids[ids.length - 1], 120000);
    const list = await listJobs(API, USER, "doc-list-1");
    expect(list).toHaveLength(MAX_JOBS_PER_DOC);
    expect(list.every((j) => j.status === "done" && j.kind === "calibration" && j.area === "Calibration" && j.widthPx === 720)).toBe(true);
    expect(list[0].id).toBe(ids[ids.length - 1]);
    expect(list.map((j) => j.id)).not.toContain(ids[0]);
    for (let i = 1; i < list.length; i++) expect(list[i - 1].createdAt).toBeGreaterThanOrEqual(list[i].createdAt);
    expect(await listJobs(API, USER, "doc-list-2")).toEqual([]);
    expect(await listJobs(API, "someone-else", "doc-list-1")).toEqual([]);
  }, 180000);
});
