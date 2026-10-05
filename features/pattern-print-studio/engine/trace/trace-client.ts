import type { RawImage, TraceResult, TraceSettings } from "./trace-core";
import type { TraceMessage, TraceRequest } from "./trace.worker";

export interface TraceJob {
  promise: Promise<TraceResult>;
  /** Stops the trace immediately; the promise then rejects with a "cancelled" Error. */
  cancel: () => void;
}

/**
 * Traces an image in a Web Worker. The worker and the tracing library are
 * only downloaded the first time this runs (i.e. when the Trace dialog is
 * used), never with the rest of the studio.
 */
export function runTrace(image: RawImage, settings: TraceSettings, scale: number, onProgress?: (value: number, label: string) => void): TraceJob {
  const worker = new Worker(new URL("./trace.worker.ts", import.meta.url), { type: "module" });
  let cancel = () => {};
  const promise = new Promise<TraceResult>((resolve, reject) => {
    cancel = () => {
      worker.terminate();
      reject(new Error("cancelled"));
    };
    worker.onmessage = (e: MessageEvent<TraceMessage>) => {
      const m = e.data;
      if (m.type === "progress") onProgress?.(m.value, m.label);
      else {
        worker.terminate();
        if (m.type === "done") resolve(m.result);
        else reject(new Error(m.message));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || "The tracer couldn't start."));
    };
    const request: TraceRequest = { image, settings, scale };
    worker.postMessage(request);
  });
  return { promise, cancel };
}

/** Draws an image to a canvas no larger than `maxSide` and returns its pixels plus the scale used. */
export function rasterize(source: CanvasImageSource & { width: number; height: number }, maxSide: number): { image: RawImage; scale: number } {
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h);
  return { image: { width: w, height: h, data: d.data }, scale };
}
