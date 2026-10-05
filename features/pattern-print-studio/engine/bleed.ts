// Bleed: growing a closed outline outward by a fixed distance, so the print
// runs past the cut line. Own implementation on plain polygons (no Paper.js,
// no dependency): the editor flattens the outline's curves first, and uses
// the result as the print's clip. Also the seam-preview alignment maths.

export interface Pt {
  x: number;
  y: number;
}

/** Signed area (shoelace). Its sign tells which way round the points go. */
export function polygonArea(poly: Pt[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function distToSegmentSq(q: Pt, a: Pt, b: Pt): number {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const l2 = ex * ex + ey * ey;
  const t = l2 > 0 ? Math.min(1, Math.max(0, ((q.x - a.x) * ex + (q.y - a.y) * ey) / l2)) : 0;
  const dx = a.x + ex * t - q.x;
  const dy = a.y + ey * t - q.y;
  return dx * dx + dy * dy;
}

/** Shortest distance from a point to a closed polygon's edge. */
export function distToPolygon(q: Pt, poly: Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) best = Math.min(best, distToSegmentSq(q, poly[i], poly[(i + 1) % poly.length]));
  return Math.sqrt(best);
}

/** Even-odd point-in-polygon test. */
export function pointInPolygon(q: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** True if any two edges of the closed polygon cross (edges that only share a corner do not count). */
export function selfIntersects(poly: Pt[]): boolean {
  const n = poly.length;
  if (n < 4) return false;
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // neighbours across the closing edge
      const c = poly[j];
      const d = poly[(j + 1) % n];
      if (Math.max(c.x, d.x) < minX || Math.min(c.x, d.x) > maxX || Math.max(c.y, d.y) < minY || Math.min(c.y, d.y) > maxY) continue;
      const d1 = cross(a, b, c);
      const d2 = cross(a, b, d);
      const d3 = cross(c, d, a);
      const d4 = cross(c, d, b);
      if (d1 * d2 < 0 && d3 * d4 < 0) return true;
    }
  }
  return false;
}

function clean(poly: Pt[], eps = 1e-9): Pt[] {
  const out: Pt[] = [];
  for (const p of poly) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > eps) out.push({ x: p.x, y: p.y });
  }
  while (out.length > 1 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) <= eps) out.pop();
  return out;
}

export interface OffsetOptions {
  /** How far a rounded corner may stray from a true arc, inches. */
  tolerance?: number;
  /** Offset towards the inside instead (used for holes in an outline, which the bleed makes smaller). */
  inward?: boolean;
}

/**
 * Grows a closed polygon by `d` (round corners). How it stays clean:
 *  1. every edge is moved out by d; outside corners get an arc, inside
 *     corners meet at their exact mitre point, so no local loops are made;
 *  2. any point that ends up closer than d to some OTHER part of the outline
 *     (narrow gaps, tight inside curves) is thrown away, and the boundary is
 *     cut exactly where it leaves and re-enters the allowed area.
 * The result always contains the original polygon. `bridged` counts the cuts
 * made in step 2 (0 for ordinary shapes). Returns no points if the shape
 * disappears (an inward offset bigger than the hole).
 */
export function offsetOutline(input: Pt[], d: number, opts: OffsetOptions = {}): { points: Pt[]; bridged: number } {
  const poly = clean(input);
  const n = poly.length;
  if (n < 3 || !(d > 0)) return { points: poly, bridged: 0 };
  const tol = Math.max(1e-6, opts.tolerance ?? 0.002);
  const sign = (polygonArea(poly) > 0 ? 1 : -1) * (opts.inward ? -1 : 1);
  const dir: Pt[] = [];
  const len: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    len.push(l);
    dir.push({ x: (b.x - a.x) / l, y: (b.y - a.y) / l });
  }
  // Outward normal of edge i (the side away from the material).
  const normal = (i: number): Pt => ({ x: dir[i].y * sign, y: -dir[i].x * sign });
  const stepMax = Math.min(Math.PI / 8, tol < d ? 2 * Math.acos(1 - tol / d) : Math.PI / 8);
  const maxSeg = Math.max(d, poly.reduce((s, _, i) => s + len[i], 0) / 2000);
  const raw: Pt[] = [];
  const push = (p: Pt) => {
    const last = raw[raw.length - 1];
    if (last) {
      // Long straight runs are cut into pieces, so step 2 can't miss a narrow gap halfway along one.
      const l = Math.hypot(p.x - last.x, p.y - last.y);
      if (l <= 1e-12) return;
      const k = Math.ceil(l / maxSeg);
      for (let j = 1; j < k; j++) raw.push({ x: last.x + ((p.x - last.x) * j) / k, y: last.y + ((p.y - last.y) * j) / k });
    }
    raw.push(p);
  };
  for (let i = 0; i < n; i++) {
    const prev = (i + n - 1) % n;
    const p = poly[i];
    const n0 = normal(prev);
    const n1 = normal(i);
    const turn = (dir[prev].x * dir[i].y - dir[prev].y * dir[i].x) * sign;
    const dot = Math.min(1, Math.max(-1, dir[prev].x * dir[i].x + dir[prev].y * dir[i].y));
    const theta = Math.acos(dot);
    if (turn > 1e-12) {
      // Outside corner: an arc around the corner point.
      const a0 = Math.atan2(n0.y, n0.x);
      const k = Math.max(1, Math.ceil(theta / stepMax));
      for (let j = 0; j <= k; j++) {
        const a = a0 + (sign * theta * j) / k;
        push({ x: p.x + d * Math.cos(a), y: p.y + d * Math.sin(a) });
      }
    } else {
      // Inside corner (or straight on): the two moved edges meet at the mitre point — if both are long enough to reach it.
      const reach = d * Math.tan(theta / 2);
      if (theta < Math.PI - 1e-6 && reach <= len[prev] && reach <= len[i]) {
        const k = d / (1 + n0.x * n1.x + n0.y * n1.y);
        push({ x: p.x + (n0.x + n1.x) * k, y: p.y + (n0.y + n1.y) * k });
      } else {
        push({ x: p.x + n0.x * d, y: p.y + n0.y * d });
        push({ x: p.x + n1.x * d, y: p.y + n1.y * d });
      }
    }
  }
  // Close the loop (also subdividing the last run).
  const first = raw[0];
  push({ x: first.x, y: first.y });
  raw.pop();

  const limit = d * (1 - 1e-6) - 1e-12;
  const ok = raw.map((q) => distToPolygon(q, poly) >= limit);
  if (!ok.some(Boolean)) return { points: [], bridged: 0 };
  let points: Pt[] = raw;
  let bridged = 0;
  if (!ok.every(Boolean)) {
    /** The point between a good and a bad point where the boundary crosses the limit. */
    const edge = (good: Pt, bad: Pt): Pt => {
      let lo = 0;
      let hi = 1;
      for (let k = 0; k < 28; k++) {
        const mid = (lo + hi) / 2;
        if (distToPolygon({ x: good.x + (bad.x - good.x) * mid, y: good.y + (bad.y - good.y) * mid }, poly) >= limit) lo = mid;
        else hi = mid;
      }
      return { x: good.x + (bad.x - good.x) * lo, y: good.y + (bad.y - good.y) * lo };
    };
    points = [];
    const m = raw.length;
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % m;
      if (ok[i]) points.push(raw[i]);
      if (ok[i] && !ok[j]) {
        points.push(edge(raw[i], raw[j]));
        bridged++;
      } else if (!ok[i] && ok[j]) points.push(edge(raw[j], raw[i]));
    }
  }
  // Tidy: drop repeated points and points in the middle of a straight run.
  points = clean(points);
  const out: Pt[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = out.length ? out[out.length - 1] : points[(i + points.length - 1) % points.length];
    const b = points[i];
    const c = points[(i + 1) % points.length];
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const along = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y);
    const base = Math.hypot(c.x - a.x, c.y - a.y);
    if (base > 0 && Math.abs(cross) / base < 1e-9 && along > 0) continue;
    out.push(b);
  }
  return { points: out.length >= 3 ? out : points, bridged };
}

/** offsetOutline, points only. */
export function offsetPolygon(poly: Pt[], d: number, opts?: OffsetOptions): Pt[] {
  return offsetOutline(poly, d, opts).points;
}

// ---------------------------------------------------------------- seam match
/** [a, b, c, d, tx, ty]: x' = a·x + c·y + tx, y' = b·x + d·y + ty (same layout as repeat.ts). */
export type Rigid = [number, number, number, number, number, number];

/**
 * Seam preview: the turn-and-move (never a flip, never a stretch) that lays
 * piece B against piece A along a seam. A's seam runs a0 → a1 and B's
 * b0 → b1; the seams' midpoints meet and the seams line up, with B on the
 * far side of the seam from A (`insideA` / `insideB` are any points inside
 * each piece, e.g. their centres).
 */
export function seamTransform(a0: Pt, a1: Pt, b0: Pt, b1: Pt, insideA: Pt, insideB: Pt): Rigid {
  const side = (p: Pt, s0: Pt, s1: Pt) => (s1.x - s0.x) * (p.y - s0.y) - (s1.y - s0.y) * (p.x - s0.x);
  const build = (flip: boolean): Rigid => {
    const from = flip ? b1 : b0;
    const to = flip ? b0 : b1;
    const ang = Math.atan2(a1.y - a0.y, a1.x - a0.x) - Math.atan2(to.y - from.y, to.x - from.x);
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const mx = (b0.x + b1.x) / 2;
    const my = (b0.y + b1.y) / 2;
    const tx = (a0.x + a1.x) / 2 - (cos * mx - sin * my);
    const ty = (a0.y + a1.y) / 2 - (sin * mx + cos * my);
    return [cos, sin, -sin, cos, tx, ty];
  };
  const sa = side(insideA, a0, a1);
  for (const flip of [false, true]) {
    const m = build(flip);
    const p = applyRigid(m, insideB);
    if (side(p, a0, a1) * sa < 0) return m;
  }
  return build(false);
}

export function applyRigid(m: Rigid, p: Pt): Pt {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

/** A movement seen in the preview, turned back into the real piece's own directions. */
export function unrotate(m: Rigid, v: Pt): Pt {
  return { x: m[0] * v.x + m[1] * v.y, y: m[2] * v.x + m[3] * v.y };
}

/**
 * The stretch of an outline a click picks as a "seam edge": from the corner
 * before the clicked curve to the corner after it. `corners` are the node
 * indices where the outline turns sharply; `count` is the number of nodes
 * (= curves, the outline is closed). Returns node indices [from, to]; `to`
 * can be smaller than `from` when the edge wraps past the start. With fewer
 * than two corners the edge is just the clicked curve.
 */
export function edgeBetweenCorners(corners: number[], count: number, curveIndex: number): [number, number] {
  const sorted = [...corners].sort((a, b) => a - b);
  if (sorted.length < 2) return [curveIndex, (curveIndex + 1) % count];
  let from = sorted[sorted.length - 1];
  for (const c of sorted) if (c <= curveIndex) from = c;
  if (sorted[0] > curveIndex) from = sorted[sorted.length - 1];
  const to = sorted.find((c) => c > curveIndex) ?? sorted[0];
  return [from, to];
}
