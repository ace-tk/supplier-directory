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
