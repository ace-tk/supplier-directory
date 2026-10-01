import type paper from "paper/dist/paper-core";
import type { GridSettings, Origin } from "./types";

type PaperScope = typeof paper;

const MIN_MAJOR_PX = 8; // below this, skip major lines (keep every Nth)

/**
 * Rebuilds the grid for the visible area only: one CompoundPath for minor
 * lines and one for major lines, 1 screen pixel wide (strokeScaling off).
 * Minor lines fade in/out with zoom so the grid never turns into a grey mess.
 * Lines are aligned to the ruler origin, like CorelDRAW.
 */
export function rebuildGrid(ps: PaperScope, layer: paper.Layer, grid: GridSettings, origin: Origin, view: paper.Rectangle, ppi: number) {
  layer.removeChildren();
  if (!grid.visible || grid.spacing <= 0) return;

  let major = grid.spacing;
  while (major * ppi < MIN_MAJOR_PX) major *= 2;
  const minor = grid.spacing / Math.max(1, grid.subdivisions);
  const minorPx = minor * ppi;
  const minorAlpha = major === grid.spacing ? Math.max(0, Math.min(1, (minorPx - 6) / 14)) : 0;
  const majorAlpha = Math.max(0.25, Math.min(1, (major * ppi - MIN_MAJOR_PX) / 30));

  const addLines = (step: number, color: string, alpha: number, skipEvery: number) => {
    if (alpha <= 0.01) return;
    const cp = new ps.CompoundPath({ insert: false });
    const x0 = Math.floor((view.left - origin.x) / step);
    const x1 = Math.ceil((view.right - origin.x) / step);
    for (let i = x0; i <= x1; i++) {
      if (skipEvery && i % skipEvery === 0) continue;
      const x = origin.x + i * step;
      cp.addChild(new ps.Path({ segments: [[x, view.top], [x, view.bottom]], insert: false }));
    }
    const y0 = Math.floor((view.top - origin.y) / step);
    const y1 = Math.ceil((view.bottom - origin.y) / step);
    for (let i = y0; i <= y1; i++) {
      if (skipEvery && i % skipEvery === 0) continue;
      const y = origin.y + i * step;
      cp.addChild(new ps.Path({ segments: [[view.left, y], [view.right, y]], insert: false }));
    }
    cp.strokeColor = new ps.Color(color);
    cp.strokeColor.alpha = alpha;
    cp.strokeWidth = 1;
    cp.strokeScaling = false;
    layer.addChild(cp);
  };

  // Minor lines skip positions that a major line already covers.
  addLines(minor, "#7c8aa5", minorAlpha * 0.45, Math.round(major / minor));
  addLines(major, "#5b6b8c", majorAlpha * 0.55, 0);
}
