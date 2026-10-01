import type { Guide, Origin, PageSize, SnapSettings } from "./types";

/** Snap distance in screen pixels. */
export const SNAP_PX = 8;

export interface SnapTargets {
  xs: { v: number; label: string }[];
  ys: { v: number; label: string }[];
  nodes: NodeIndex | null;
  gridStep: number | null;
  origin: Origin;
}

export interface SnapResult {
  dx: number;
  dy: number;
  label: string | null;
  /** Where to draw the snap marker (project inches). */
  at: { x: number; y: number } | null;
}

/** Uniform-grid spatial hash over node points, for fast nearest-node lookup. */
export class NodeIndex {
  private cells = new Map<string, { x: number; y: number }[]>();
  constructor(private cell: number) {}
  add(x: number, y: number) {
    const k = `${Math.floor(x / this.cell)},${Math.floor(y / this.cell)}`;
    let list = this.cells.get(k);
    if (!list) this.cells.set(k, (list = []));
    list.push({ x, y });
  }
  nearest(x: number, y: number, maxDist: number): { x: number; y: number } | null {
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    const r = Math.ceil(maxDist / this.cell);
    let best: { x: number; y: number } | null = null;
    let bestD = maxDist;
    for (let i = cx - r; i <= cx + r; i++) {
      for (let j = cy - r; j <= cy + r; j++) {
        for (const p of this.cells.get(`${i},${j}`) ?? []) {
          const d = Math.hypot(p.x - x, p.y - y);
          if (d <= bestD) {
            bestD = d;
            best = p;
          }
        }
      }
    }
    return best;
  }
}

export function buildTargets(opts: {
  snap: SnapSettings;
  guides: Guide[];
  guidesVisible: boolean;
  page: PageSize;
  origin: Origin;
  gridStep: number;
  objectBounds: { left: number; right: number; top: number; bottom: number }[];
  nodePoints: { x: number; y: number }[];
  threshold: number;
}): SnapTargets {
  const xs: SnapTargets["xs"] = [];
  const ys: SnapTargets["ys"] = [];
  if (opts.snap.guides && opts.guidesVisible) {
    for (const g of opts.guides) (g.orientation === "v" ? xs : ys).push({ v: g.pos, label: "Guideline" });
  }
  if (opts.snap.page) {
    xs.push({ v: 0, label: "Page edge" }, { v: opts.page.width, label: "Page edge" }, { v: opts.page.width / 2, label: "Page center" });
    ys.push({ v: 0, label: "Page edge" }, { v: opts.page.height, label: "Page edge" }, { v: opts.page.height / 2, label: "Page center" });
  }
  let nodes: NodeIndex | null = null;
  if (opts.snap.objects) {
    for (const b of opts.objectBounds) {
      xs.push({ v: b.left, label: "Object edge" }, { v: b.right, label: "Object edge" }, { v: (b.left + b.right) / 2, label: "Object center" });
      ys.push({ v: b.top, label: "Object edge" }, { v: b.bottom, label: "Object edge" }, { v: (b.top + b.bottom) / 2, label: "Object center" });
    }
    if (opts.nodePoints.length) {
      nodes = new NodeIndex(Math.max(opts.threshold * 4, 1e-6));
      for (const p of opts.nodePoints) nodes.add(p.x, p.y);
    }
  }
  return { xs, ys, nodes, gridStep: opts.snap.grid ? opts.gridStep : null, origin: opts.origin };
}

function snapAxis(values: number[], lines: { v: number; label: string }[], gridStep: number | null, gridOrigin: number, threshold: number) {
  let best: { d: number; label: string; at: number } | null = null;
  for (const v of values) {
    for (const l of lines) {
      const d = l.v - v;
      if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, label: l.label, at: l.v };
    }
    if (gridStep) {
      const g = gridOrigin + Math.round((v - gridOrigin) / gridStep) * gridStep;
      const d = g - v;
      // Explicit targets (guides, page, objects) win ties over the grid.
      if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.d) - 1e-9)) best = { d, label: "Grid", at: g };
    }
  }
  return best;
}

/**
 * Snaps a moving set of key points (e.g. a selection's left/center/right ×
 * top/middle/bottom). Nodes snap in 2D and win; otherwise each axis snaps
 * independently to the nearest line.
 */
export function snapPoints(points: { x: number; y: number }[], t: SnapTargets, threshold: number): SnapResult {
  if (t.nodes) {
    let best: { d: number; dx: number; dy: number; at: { x: number; y: number } } | null = null;
    for (const p of points) {
      const n = t.nodes.nearest(p.x, p.y, threshold);
      if (n) {
        const d = Math.hypot(n.x - p.x, n.y - p.y);
        if (!best || d < best.d) best = { d, dx: n.x - p.x, dy: n.y - p.y, at: n };
      }
    }
    if (best) return { dx: best.dx, dy: best.dy, label: "Node", at: best.at };
  }
  const sx = snapAxis(
    points.map((p) => p.x),
    t.xs,
    t.gridStep,
    t.origin.x,
    threshold
  );
  const sy = snapAxis(
    points.map((p) => p.y),
    t.ys,
    t.gridStep,
    t.origin.y,
    threshold
  );
  if (!sx && !sy) return { dx: 0, dy: 0, label: null, at: null };
  const label = sx && sy ? (sx.label === sy.label ? sx.label : `${sx.label} + ${sy.label}`) : (sx ?? sy)!.label;
  return {
    dx: sx?.d ?? 0,
    dy: sy?.d ?? 0,
    label,
    at: { x: sx ? sx.at : points[0].x, y: sy ? sy.at : points[0].y },
  };
}
