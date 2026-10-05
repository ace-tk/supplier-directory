"use client";

import { useState } from "react";
import { CircleCheck, CircleX, Download, Loader2, RefreshCw, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { cancelExport, isActive, retryExport, startCalibration, STEP_LABEL, type ExportJob } from "../export/client";
import { formatBytes, formatDuration } from "../export/options";
import type { ExportJobs } from "./useExportJobs";

const when = (ms: number) => new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const say = (err: unknown, fallback: string) => toast.error(err instanceof Error ? err.message : fallback);

function Bar({ job }: { job: ExportJob }) {
  const pct = Math.round(job.progress * 100);
  return (
    <div className="grid gap-0.5">
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`Export progress: ${STEP_LABEL[job.step]}`}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-muted-foreground" data-job-step>
        {pct}% · {STEP_LABEL[job.step]}
      </span>
    </div>
  );
}

/** The export list (last 20 exports of this document) with progress, cancel, retry and download, plus the calibration test. */
export function ExportsPanel({ api, docId, docName, exports, onOpenExport }: { api: string; docId: string; docName: string; exports: ExportJobs; onOpenExport: () => void }) {
  const [dpi, setDpi] = useState(150);
  const { jobs, error, track, download, refresh } = exports;
  const cancel = (job: ExportJob) => cancelExport(api, job).then(() => track(), (e) => say(e, "The export could not be cancelled."));
  const retry = (job: ExportJob) => retryExport(api, job).then((j) => track(j), (e) => say(e, "The export could not be retried."));
  const calibrate = () => startCalibration(api, { docId, docName, dpi }).then((j) => (track(j), toast.info("Calibration test started")), (e) => say(e, "The calibration test could not be started."));

  return (
    <section className="grid gap-2 rounded-md border border-border p-2" aria-label="Exports">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">Exports</span>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" aria-label="Refresh the export list" title="Refresh the list" onClick={() => void refresh()}>
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button size="sm" onClick={onOpenExport} title="Ctrl+E">
            Export…
          </Button>
        </div>
      </div>
      {error && <p className="text-red-600">{error}</p>}
      {!jobs.length && !error && <p className="text-muted-foreground">No exports of this document yet.</p>}
      <div className="grid gap-1.5" role="list" aria-label="Export list">
        {jobs.map((job) => (
          <div key={job.id} role="listitem" data-status={job.status} className="grid gap-1 rounded border border-border p-1.5">
            <div className="flex items-start gap-1.5">
              {job.status === "done" ? <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : job.status === "failed" ? <CircleX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" /> : job.status === "cancelled" ? <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-primary" />}
              <span className="min-w-0 break-all font-medium text-foreground" title={job.fileName}>
                {job.fileName}
              </span>
            </div>
            <span className="text-muted-foreground">
              {job.area} · {job.format === "pdf" ? `PDF · ${job.widthIn.toFixed(2)} × ${job.heightIn.toFixed(2)} in` : `${job.dpi} DPI · ${job.widthPx.toLocaleString("en-US")} × ${job.heightPx.toLocaleString("en-US")} px`}
              {job.bytes ? ` · ${formatBytes(job.bytes)}` : ""} · {when(job.createdAt)}
              {job.status === "done" && job.seconds ? ` · took ${formatDuration(job.seconds)}` : ""}
            </span>
            {isActive(job) && <Bar job={job} />}
            {job.status === "failed" && <span className="text-red-600">{job.error}</span>}
            {job.status === "cancelled" && <span className="text-muted-foreground">Cancelled.</span>}
            <div className="flex gap-1.5">
              {isActive(job) && (
                <Button size="sm" variant="outline" onClick={() => void cancel(job)}>
                  Cancel
                </Button>
              )}
              {job.status === "done" && (
                <Button size="sm" variant="outline" onClick={() => void download(job)} title="Uses a fresh download link (links expire after 1 hour)">
                  <Download className="mr-1 h-3 w-3" /> Download
                </Button>
              )}
              {(job.status === "failed" || job.status === "cancelled") && (
                <Button size="sm" variant="outline" onClick={() => void retry(job)}>
                  <RotateCcw className="mr-1 h-3 w-3" /> Retry
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-1 border-t border-border pt-2">
        <span className="font-medium text-foreground">Calibration test</span>
        <p className="text-muted-foreground">A 10 × 10 in TIFF with inch ticks and a 5 in square. Print it once and measure it with a ruler to prove the scale.</p>
        <div className="flex items-center gap-1.5">
          <select aria-label="Calibration DPI" value={dpi} onChange={(e) => setDpi(Number(e.target.value))} className={cn("h-7 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary")}>
            <option value={150}>150 DPI</option>
            <option value={300}>300 DPI</option>
          </select>
          <Button size="sm" variant="outline" onClick={() => void calibrate()}>
            Make calibration test
          </Button>
        </div>
      </div>
    </section>
  );
}

/** A small floating progress chip over the canvas while an export is running, so it is visible from any tab. */
export function ExportProgressChip({ api, exports }: { api: string; exports: ExportJobs }) {
  const job = exports.jobs.find(isActive);
  if (!job) return null;
  const pct = Math.round(job.progress * 100);
  return (
    <div role="status" aria-label="Export in progress" className="fixed bottom-10 left-1/2 z-40 flex w-80 -translate-x-1/2 items-center gap-2 rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
      <div className="grid min-w-0 flex-1 gap-1">
        <span className="truncate text-foreground" title={job.fileName}>
          Exporting {job.area} {job.format === "pdf" ? "as PDF" : `at ${job.dpi} DPI`} — {pct}% · {STEP_LABEL[job.step]}
        </span>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={() => void cancelExport(api, job).then(() => exports.track(), (e) => say(e, "The export could not be cancelled."))}>
        Cancel
      </Button>
    </div>
  );
}
