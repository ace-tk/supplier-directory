"use client";

import { getPdfjs, dataUrlToUint8Array } from "@/lib/pdf-client";

// Real, lazily-rendered PDF page-1 thumbnails (via pdfjs), cached in memory
// per attachment so repeated hovers don't re-render. Never a fake/generic
// thumbnail — non-PDF files simply don't get one.
const cache = new Map<string, Promise<{ dataUrl: string; numPages: number } | null>>();

function keyFor(id: string | undefined, dataUrl: string): string {
  return id ?? `${dataUrl.length}:${dataUrl.slice(0, 64)}`;
}

export function getPdfThumbnail(id: string | undefined, dataUrl: string): Promise<{ dataUrl: string; numPages: number } | null> {
  const key = keyFor(id, dataUrl);
  const cached = cache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const pdfjs = await getPdfjs();
      const doc = await pdfjs.getDocument({ data: dataUrlToUint8Array(dataUrl) }).promise;
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: 0.35 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      await page.render({ canvasContext: ctx, viewport }).promise;
      return { dataUrl: canvas.toDataURL("image/png"), numPages: doc.numPages };
    } catch {
      return null;
    }
  })();

  cache.set(key, promise);
  return promise;
}
