"use client";

import { toast } from "sonner";

export interface DetailLine {
  label: string;
  value: string;
}

export interface DownloadPayload {
  fileName: string;
  title: string;
  lines: DetailLine[];
}

function formatPayload({ title, lines }: DownloadPayload): string {
  const rule = "=".repeat(title.length);
  const body = lines.map((l) => `${l.label}: ${l.value}`).join("\n");
  return `${title}\n${rule}\n\n${body}\n`;
}

// Mock export — swap the body for a real `/api/.../export` call later;
// call sites only depend on this function's signature, not its internals.
export function downloadDetails(payload: DownloadPayload) {
  const content = formatPayload(payload);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = payload.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success("Details downloaded");
}

export interface SharePayload {
  title: string;
  text: string;
  url: string;
}

// Mock share — uses the native Web Share sheet where available, otherwise
// copies a link. Swap for a real share/short-link API later without
// touching call sites.
export async function shareDetails(payload: SharePayload) {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share(payload);
      return;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(payload.url);
    toast.success("Link copied to clipboard");
    return;
  }
  toast.error("Sharing isn't supported on this device");
}
