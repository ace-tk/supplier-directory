"use client";

// Lazily-loaded pdfjs-dist — only ever imported inside client components
// that actually render a PDF, never at module top-level, so it never
// touches the server bundle or the initial client bundle either.

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

export function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      return lib;
    });
  }
  return pdfjsPromise;
}

/** Attachments are stored as base64 data URLs (see ContentAttachment) —
 * pdfjs wants raw bytes, not the data: URI string. */
export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function dataUrlToText(dataUrl: string): string {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  try {
    return decodeURIComponent(escape(atob(base64)));
  } catch {
    return atob(base64);
  }
}

/** Real per-page text extraction via pdfjs's own text layer (the same
 * layer it uses for text selection) — never a fabricated summary of a PDF
 * that couldn't actually be parsed. Returns "" if the PDF has no
 * extractable text layer (e.g. a scanned image PDF). */
export async function extractPdfText(dataUrl: string): Promise<string> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: dataUrlToUint8Array(dataUrl) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    if (text.trim()) pages.push(text.trim());
  }
  return pages.join("\n\n");
}
