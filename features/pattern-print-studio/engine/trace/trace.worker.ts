/// <reference lib="webworker" />
// Runs the tracer off the main thread, so the studio never freezes. One
// request per worker: the client terminates it to cancel.
import { flattenOnWhite, isNearWhite, pickPalette, toBinary, tracerNumbers, type RawImage, type RGBA, type TraceResult, type TraceSettings, type TraceShape } from "./trace-core";

export interface TraceRequest {
  image: RawImage;
  settings: TraceSettings;
  /** Traced size ÷ full size. */
  scale: number;
}
export type TraceMessage = { type: "progress"; value: number; label: string } | { type: "done"; result: TraceResult } | { type: "error"; message: string };

const post = (m: TraceMessage) => (self as DedicatedWorkerGlobalScope).postMessage(m);

self.onmessage = async (e: MessageEvent<TraceRequest>) => {
  try {
    const { image, settings, scale } = e.data;
    post({ type: "progress", value: 0.02, label: "Loading tracer" });
    const tracer = (await import("imagetracerjs")).default;
    const n = tracerNumbers(settings, scale);
    const bw = settings.mode === "bw";

    post({ type: "progress", value: 0.08, label: "Preparing image" });
    let source: RawImage = bw ? image : flattenOnWhite(image);
    if (n.blurRadius > 0) {
      const blurred = tracer.blur(source, n.blurRadius, 1024);
      source = { width: source.width, height: source.height, data: Uint8ClampedArray.from(blurred.data) };
    }
    if (bw) source = toBinary(source, settings.threshold);
    const palette: RGBA[] = bw
      ? [
          [0, 0, 0, 255],
          [255, 255, 255, 255],
        ]
      : pickPalette(source, Math.min(8, Math.max(2, settings.colors)));

    const options = tracer.checkoptions({
      ltres: n.fit,
      qtres: n.fit,
      pathomit: n.minPath,
      rightangleenhance: true,
      linefilter: settings.smoothing > 60,
      blurradius: 0,
      // Our own palette; refine it a little for colour images, never randomly.
      pal: palette.map(([r, g, b, a]) => ({ r, g, b, a })),
      colorquantcycles: bw ? 1 : 3,
      mincolorratio: 0,
    });

    post({ type: "progress", value: 0.2, label: bw ? "Separating black from white" : "Reducing colours" });
    const indexed = tracer.colorquantization(source, options);
    const shapes: TraceShape[] = [];
    let nodes = 0;
    const count = indexed.palette.length;
    for (let k = 0; k < count; k++) {
      post({ type: "progress", value: 0.3 + (0.65 * k) / count, label: `Tracing ${bw ? "outlines" : `colour ${k + 1} of ${count}`}` });
      const c = indexed.palette[k];
      const color: RGBA = [c.r, c.g, c.b, c.a];
      if (settings.removeBackground && isNearWhite(color)) continue;
      const paths = tracer.batchtracepaths(tracer.internodes(tracer.pathscan(tracer.layeringstep(indexed, k), options.pathomit), options), options.ltres, options.qtres);
      const sub = (i: number): TraceShape["subpaths"][number] | null => {
        const segs = paths[i]?.segments;
        if (!segs?.length) return null;
        nodes += segs.length;
        return { start: [segs[0].x1, segs[0].y1], segs: segs.map((s) => (s.type === "Q" ? ["Q", s.x2, s.y2, s.x3!, s.y3!] : ["L", s.x2, s.y2])) };
      };
      paths.forEach((p, i) => {
        if (p.isholepath) return;
        const outline = sub(i);
        if (!outline) return;
        const holes = p.holechildren.map(sub).filter((h): h is NonNullable<typeof h> => !!h);
        shapes.push({ color, subpaths: [outline, ...holes] });
      });
    }
    post({ type: "done", result: { width: source.width, height: source.height, shapes, nodes } });
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : "Tracing failed." });
  }
};
