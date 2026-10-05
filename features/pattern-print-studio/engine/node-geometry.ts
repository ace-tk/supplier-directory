// Pure bezier-node maths for the Shape tool. No Paper.js here, so these are
// easy to unit-test. Vectors are plain {x, y} in inches; handles are relative
// to their node, as Paper.js stores them.

export interface Vec {
  x: number;
  y: number;
}

/** c = cusp (independent handles), s = smooth (collinear), y = symmetrical (collinear + equal length). */
export type NodeType = "c" | "s" | "y";

export const NODE_TYPE_LABEL: Record<NodeType, string> = { c: "Cusp", s: "Smooth", y: "Symmetrical" };

const len = (v: Vec) => Math.hypot(v.x, v.y);
const scale = (v: Vec, k: number): Vec => ({ x: v.x * k, y: v.y * k });
const norm = (v: Vec): Vec | null => {
  const l = len(v);
  return l > 0 ? { x: v.x / l, y: v.y / l } : null;
};

/** Handles within ~0.6° of a straight line count as collinear (SVG exports round coordinates). */
const COLLINEAR_SIN = 0.01;
const EQUAL_LENGTH = 0.01;

/** Works out a node's type from its handles (used when a file doesn't say). */
export function inferNodeType(handleIn: Vec, handleOut: Vec): NodeType {
  const a = len(handleIn);
  const b = len(handleOut);
  if (a === 0 || b === 0) return "c";
  const dot = handleIn.x * handleOut.x + handleIn.y * handleOut.y;
  const cross = handleIn.x * handleOut.y - handleIn.y * handleOut.x;
  if (dot >= 0 || Math.abs(cross) > COLLINEAR_SIN * a * b) return "c";
  return Math.abs(a - b) <= EQUAL_LENGTH * Math.max(a, b) ? "y" : "s";
}

/**
 * Handles for a node being made smooth or symmetrical. `toPrev` / `toNext`
 * are vectors from the node to its neighbours (null at the end of an open
 * path). A side that is a straight line keeps no handle; the other handle
 * lines up with it. A corner between two lines gets new handles a third of
 * the way to each neighbour.
 */
export function smoothedHandles(handleIn: Vec, handleOut: Vec, toPrev: Vec | null, toNext: Vec | null, symmetrical: boolean): { handleIn: Vec; handleOut: Vec } {
  let a = len(handleIn);
  let b = len(handleOut);
  let dir: Vec | null;
  if (a === 0 && b === 0) {
    if (!toPrev || !toNext) return { handleIn, handleOut };
    dir = norm({ x: toNext.x - toPrev.x, y: toNext.y - toPrev.y });
    a = len(toPrev) / 3;
    b = len(toNext) / 3;
  } else if (a === 0) {
    dir = (toPrev && norm(scale(toPrev, -1))) ?? norm(handleOut);
  } else if (b === 0) {
    dir = (toNext && norm(toNext)) ?? norm(scale(handleIn, -1));
  } else {
    const ni = norm(handleIn)!;
    const no = norm(handleOut)!;
    dir = norm({ x: no.x - ni.x, y: no.y - ni.y }) ?? no;
  }
  if (!dir) return { handleIn, handleOut };
  if (symmetrical && a > 0 && b > 0) a = b = (a + b) / 2;
  return { handleIn: scale(dir, -a), handleOut: scale(dir, b) };
}

/** After one handle moved: where the opposite handle must be for this node type. */
export function constrainOpposite(moved: Vec, opposite: Vec, type: NodeType): Vec {
  if (type === "c") return opposite;
  if (type === "y") return scale(moved, -1);
  const l = len(opposite);
  const d = norm(moved);
  return l === 0 || !d ? opposite : scale(d, -l);
}

/**
 * Dragging a point on a curve (at parameter t) by `delta`: how far to move
 * the curve's two control handles so the grabbed point follows the pointer
 * and the end nodes stay put. Near an end, only that end's handle moves.
 */
export function curveDragOffsets(t: number, delta: Vec): { first: Vec; second: Vec } {
  t = Math.min(0.95, Math.max(0.05, t));
  let w: number;
  if (t <= 1 / 6) w = 0;
  else if (t <= 0.5) w = Math.pow((6 * t - 1) / 2, 3) / 2;
  else if (t <= 5 / 6) w = (1 - Math.pow((6 * (1 - t) - 1) / 2, 3)) / 2 + 0.5;
  else w = 1;
  return {
    first: scale(delta, (1 - w) / (3 * t * (1 - t) * (1 - t))),
    second: scale(delta, w / (3 * t * t * (1 - t))),
  };
}

/** Node types as stored on a path: one letter per node. Returns null if it doesn't match the node count. */
export function parseNodeTypes(value: unknown, count: number): NodeType[] | null {
  if (typeof value !== "string" || value.length !== count || /[^csy]/.test(value)) return null;
  return value.split("") as NodeType[];
}

/** Cubic Bernstein weights at t. */
function bernstein(t: number): [number, number, number, number] {
  const m = 1 - t;
  return [m * m * m, 3 * m * m * t, 3 * m * t * t, t * t * t];
}

/**
 * Deleting a node: finds handle lengths for ONE curve from `a` to `c` that
 * best follows the two curves it replaces. `dirA` / `dirC` are the unit
 * tangent directions leaving a and c (kept, so the neighbours stay smooth);
 * `samples` are points on the old shape with t = their fraction of its
 * length. Least squares on the two lengths; falls back to a third of the
 * chord when the fit is degenerate.
 */
export function fitHandleLengths(a: Vec, dirA: Vec, c: Vec, dirC: Vec, samples: { p: Vec; t: number }[]): { alpha: number; beta: number } {
  const fallback = len({ x: c.x - a.x, y: c.y - a.y }) / 3;
  const dd = dirA.x * dirC.x + dirA.y * dirC.y;
  const ts = samples.map((s) => s.t);
  let best: { alpha: number; beta: number } | null = null;
  // Solve for the two lengths, then move each sample's t to the nearest point on the fitted curve and solve again.
  for (let pass = 0; pass < 6; pass++) {
    let s11 = 0;
    let s12 = 0;
    let s22 = 0;
    let r1 = 0;
    let r2 = 0;
    samples.forEach(({ p }, i) => {
      const [b0, b1, b2, b3] = bernstein(ts[i]);
      const rx = p.x - (b0 + b1) * a.x - (b2 + b3) * c.x;
      const ry = p.y - (b0 + b1) * a.y - (b2 + b3) * c.y;
      s11 += b1 * b1;
      s12 += b1 * b2 * dd;
      s22 += b2 * b2;
      r1 += b1 * (dirA.x * rx + dirA.y * ry);
      r2 += b2 * (dirC.x * rx + dirC.y * ry);
    });
    const det = s11 * s22 - s12 * s12;
    if (Math.abs(det) < 1e-12) break;
    const alpha = (r1 * s22 - r2 * s12) / det;
    const beta = (s11 * r2 - s12 * r1) / det;
    if (!(alpha > 0) || !(beta > 0) || !Number.isFinite(alpha + beta)) break;
    best = { alpha, beta };
    // One Newton step per sample towards its closest point on this curve.
    const p1 = { x: a.x + dirA.x * alpha, y: a.y + dirA.y * alpha };
    const p2 = { x: c.x + dirC.x * beta, y: c.y + dirC.y * beta };
    samples.forEach(({ p }, i) => {
      const t = ts[i];
      const m = 1 - t;
      const [b0, b1, b2, b3] = bernstein(t);
      const qx = b0 * a.x + b1 * p1.x + b2 * p2.x + b3 * c.x - p.x;
      const qy = b0 * a.y + b1 * p1.y + b2 * p2.y + b3 * c.y - p.y;
      const d1x = 3 * (m * m * (p1.x - a.x) + 2 * m * t * (p2.x - p1.x) + t * t * (c.x - p2.x));
      const d1y = 3 * (m * m * (p1.y - a.y) + 2 * m * t * (p2.y - p1.y) + t * t * (c.y - p2.y));
      const d2x = 6 * (m * (p2.x - 2 * p1.x + a.x) + t * (c.x - 2 * p2.x + p1.x));
      const d2y = 6 * (m * (p2.y - 2 * p1.y + a.y) + t * (c.y - 2 * p2.y + p1.y));
      const den = d1x * d1x + d1y * d1y + qx * d2x + qy * d2y;
      if (Math.abs(den) > 1e-12) ts[i] = Math.min(1, Math.max(0, t - (qx * d1x + qy * d1y) / den));
    });
  }
  return best ?? { alpha: fallback, beta: fallback };
}

/** Direction change at a node, in degrees (0 = straight through). `incoming` points into the node, `outgoing` away from it. */
export function turnAngle(incoming: Vec, outgoing: Vec): number {
  const a = len(incoming);
  const b = len(outgoing);
  if (a === 0 || b === 0) return 0;
  const cos = Math.min(1, Math.max(-1, (incoming.x * outgoing.x + incoming.y * outgoing.y) / (a * b)));
  return (Math.acos(cos) * 180) / Math.PI;
}
