"use client";

// Lazily-loaded mammoth — only ever imported inside client components that
// actually render/extract a DOCX, never at module top-level. mammoth's
// package.json "browser" field swaps in its browser-safe unzip/file
// modules automatically when bundled for the client.

import { dataUrlToUint8Array } from "@/lib/pdf-client";
import { sanitizeEditorHtml } from "@/lib/ai/sanitize-html";

let mammothPromise: Promise<typeof import("mammoth")> | null = null;

function getMammoth() {
  if (!mammothPromise) mammothPromise = import("mammoth");
  return mammothPromise;
}

export interface DocxRenderResult {
  /** Sanitized HTML — safe for dangerouslySetInnerHTML and for inserting
   * into Tiptap. mammoth only understands the OOXML zip format, so this
   * must never be called on legacy .doc. */
  html: string;
  warnings: string[];
}

export async function renderDocxToHtml(dataUrl: string): Promise<DocxRenderResult> {
  const mammoth = await getMammoth();
  const bytes = dataUrlToUint8Array(dataUrl);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return {
    html: sanitizeEditorHtml(result.value),
    warnings: result.messages.map((m) => m.message),
  };
}
