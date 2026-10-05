"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { formatBytes } from "../export/options";
import { freshLink, isActive, listExports, openDownload, type ExportJob } from "../export/client";

/**
 * The exports of the open document: loads the list, keeps polling while a
 * job is waiting or running, and announces each job when it ends.
 */
export function useExportJobs(api: string, docId: string | null) {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const known = useRef(new Map<string, ExportJob["status"]>());

  const download = useCallback(
    async (job: ExportJob) => {
      try {
        // Always through a fresh link: the one in the list may have expired.
        const link = await freshLink(api, job);
        openDownload(link.url, job.fileName);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "The download could not be started.");
      }
    },
    [api]
  );

  const refresh = useCallback(async () => {
    if (!docId) return;
    try {
      const list = await listExports(api, docId);
      setError(null);
      for (const job of list) {
        const before = known.current.get(job.id);
        known.current.set(job.id, job.status);
        // Only jobs seen running in this session are announced (not old ones found on reload).
        if (!before || before === job.status || !(before === "queued" || before === "running")) continue;
        if (job.status === "done") toast.success(`Export ready: ${job.fileName}${job.bytes ? ` (${formatBytes(job.bytes)})` : ""}`, { duration: 15000, action: { label: "Download", onClick: () => void download(job) } });
        else if (job.status === "failed") toast.error(`Export failed: ${job.error ?? "unknown reason"}`, { duration: 15000 });
        else if (job.status === "cancelled") toast.info(`Export cancelled: ${job.fileName}`);
      }
      setJobs(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The export list could not be loaded.");
    }
  }, [api, docId, download]);

  // A different document: its own list is loaded from the server.
  useEffect(() => {
    known.current = new Map();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the list comes from the server; state is set when the answer arrives
    void refresh();
  }, [refresh]);

  // While anything is waiting or running, ask again every second.
  const busy = jobs.some(isActive);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => void refresh(), 1000);
    return () => clearInterval(t);
  }, [busy, refresh]);

  /** Call after starting, cancelling or retrying a job. */
  const track = useCallback(
    (job?: ExportJob) => {
      if (job) known.current.set(job.id, job.status);
      void refresh();
    },
    [refresh]
  );

  return { jobs, error, refresh, track, download };
}

export type ExportJobs = ReturnType<typeof useExportJobs>;
