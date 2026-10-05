import paper from "paper/dist/paper-core";
import { beforeEach, describe, expect, it } from "vitest";
import { History } from "../engine/history";
import { constrainOpposite, curveDragOffsets, fitHandleLengths, inferNodeType, parseNodeTypes, smoothedHandles, turnAngle, unsplitHandleLengths, type Vec } from "../engine/node-geometry";
import { fromNode, pathData, toNode, type PathNode, type SceneNode } from "../engine/serialize";
import { ShapeTool, type ShapeHost } from "../engine/shape-tool";
import { nodeCount, planShaping } from "../engine/shaping";
import { isNearWhite, looksPhotographic, pickPalette, toBinary, tracerNumbers, DEFAULT_TRACE, type RawImage } from "../engine/trace/trace-core";
import { cssLengthToInches, formatUnits, fromUnits, parseLength, toUnits } from "../engine/units";

// Paper.js runs headless here (no canvas): geometry, booleans and serialisation all work.
let ps: paper.PaperScope;
beforeEach(() => {
  ps = new paper.PaperScope();
  ps.setup(new ps.Size(100, 100));
});

const len = (v: Vec) => Math.hypot(v.x, v.y);
const cross = (a: Vec, b: Vec) => a.x * b.y - a.y * b.x;

/** Largest gap between two outlines, sampled both ways (inches). */
function deviation(a: paper.Path, b: paper.Path, samples = 400): number {
  let worst = 0;
  for (let i = 0; i <= samples; i++) {
    const p = a.getPointAt((a.length * i) / samples);
    worst = Math.max(worst, b.getNearestPoint(p).getDistance(p));
    const q = b.getPointAt((b.length * i) / samples);
    worst = Math.max(worst, a.getNearestPoint(q).getDistance(q));
  }
  return worst;
}

/** A leg-like closed outline with curves and straight edges. */
function legPath(): paper.Path {
  const p = new ps.Path({ insert: true });
  p.moveTo(new ps.Point(2, 1.65));
  p.cubicCurveTo(new ps.Point(4.7, 1.45), new ps.Point(7.5, 1.1), new ps.Point(10.3, 0.9));
  p.cubicCurveTo(new ps.Point(10.45, 5.6), new ps.Point(9.7, 9.95), new ps.Point(11.3, 10.3));
  p.cubicCurveTo(new ps.Point(10.2, 13.5), new ps.Point(8.5, 16.5), new ps.Point(8.77, 18.5));
  p.lineTo(new ps.Point(8.0, 29.9));
  p.lineTo(new ps.Point(4.2, 29.9));
  p.cubicCurveTo(new ps.Point(4.0, 22), new ps.Point(2.8, 14), new ps.Point(1, 10.6));
  p.closePath();
  p.strokeColor = new ps.Color("#000");
  p.strokeWidth = 0.0076;
  p.data.id = "leg";
  return p;
}

function makeTool() {
  const layer = ps.project.activeLayer;
  let commits = 0;
  let n = 0;
  const host: ShapeHost = {
    ps,
    contentLayer: () => layer,
    px: () => 0.01,
    topLevel: (item) => {
      while (item && item.parent !== layer) item = item.parent;
      return item;
    },
    idOf: (item) => (item.data.id ??= `id${n++}`),
    snapTargets: () => ({ xs: [], ys: [], nodes: null, gridStep: null, origin: { x: 0, y: 0 } }),
    setSnap: () => {},
    setMarquee: () => {},
    selectTop: () => {},
    commit: () => void commits++,
    changed: () => {},
    selectionChanged: () => {},
  };
  return { tool: new ShapeTool(host), commits: () => commits };
}

describe("units conversion", () => {
  it("converts inches to and from display units exactly", () => {
    expect(toUnits(1, "cm")).toBe(2.54);
    expect(toUnits(1, "mm")).toBe(25.4);
    for (const u of ["in", "cm", "mm"] as const) expect(fromUnits(toUnits(163.75, u), u)).toBeCloseTo(163.75, 12);
  });
  it("parses typed lengths with or without a unit", () => {
    expect(parseLength("12.5", "in")).toBe(12.5);
    expect(parseLength("30cm", "in")).toBeCloseTo(30 / 2.54, 12);
    expect(parseLength("254 mm", "cm")).toBeCloseTo(10, 12);
    expect(parseLength('2"', "mm")).toBe(2);
    expect(parseLength("10", "mm")).toBeCloseTo(10 / 25.4, 12);
    expect(parseLength("abc", "in")).toBeNull();
  });
  it("rounds only for display, to 3 decimals, without a negative zero", () => {
    expect(formatUnits(37.694, "in")).toBe("37.694");
    expect(formatUnits(1 / 3, "in")).toBe("0.333");
    expect(formatUnits(-0.0001, "in")).toBe("0.000");
    expect(formatUnits(1, "mm")).toBe("25.400");
  });
  it("reads SVG/CSS lengths", () => {
    expect(cssLengthToInches("163.75in")).toBe(163.75);
    expect(cssLengthToInches("96")).toBe(1);
    expect(cssLengthToInches("72pt")).toBe(1);
    expect(cssLengthToInches("50%")).toBeNull();
  });
});

describe("node type conversion", () => {
  it("works out the type from the handles", () => {
    expect(inferNodeType({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe("c"); // a straight side
    expect(inferNodeType({ x: -1, y: 0 }, { x: 0, y: 1 })).toBe("c"); // a corner
    expect(inferNodeType({ x: -2, y: 0 }, { x: 1, y: 0 })).toBe("s"); // in line, different lengths
    expect(inferNodeType({ x: -1, y: -1 }, { x: 1, y: 1 })).toBe("y"); // in line, same length
    expect(inferNodeType({ x: 1, y: 0 }, { x: 2, y: 0 })).toBe("c"); // same side = cusp
  });
  it("smooth: handles become collinear and keep their lengths", () => {
    const hin = { x: -1.5, y: 0.4 };
    const hout = { x: 0.2, y: 2.4 };
    const r = smoothedHandles(hin, hout, { x: -3, y: 0 }, { x: 0, y: 5 }, false);
    expect(Math.abs(cross(r.handleIn, r.handleOut))).toBeLessThan(1e-12);
    expect(r.handleIn.x * r.handleOut.x + r.handleIn.y * r.handleOut.y).toBeLessThan(0);
    expect(len(r.handleIn)).toBeCloseTo(len(hin), 12);
    expect(len(r.handleOut)).toBeCloseTo(len(hout), 12);
    expect(inferNodeType(r.handleIn, r.handleOut)).toBe("s");
  });
  it("symmetrical: collinear and equal length", () => {
    const r = smoothedHandles({ x: -1, y: 0.5 }, { x: 3, y: 0.2 }, null, null, true);
    expect(r.handleIn.x + r.handleOut.x).toBeCloseTo(0, 12);
    expect(r.handleIn.y + r.handleOut.y).toBeCloseTo(0, 12);
    expect(inferNodeType(r.handleIn, r.handleOut)).toBe("y");
  });
  it("smoothing a corner between two straight lines gives it handles a third of the way along", () => {
    const r = smoothedHandles({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: -3, y: 0 }, { x: 0, y: 6 }, false);
    expect(len(r.handleIn)).toBeCloseTo(1, 12);
    expect(len(r.handleOut)).toBeCloseTo(2, 12);
    expect(Math.abs(cross(r.handleIn, r.handleOut))).toBeLessThan(1e-12);
  });
  it("a line on one side keeps no handle there; the other handle lines up with the line", () => {
    const r = smoothedHandles({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: -4, y: 0 }, { x: 3, y: 3 }, false);
    expect(len(r.handleIn)).toBe(0);
    expect(r.handleOut.y).toBeCloseTo(0, 12);
    expect(r.handleOut.x).toBeCloseTo(Math.SQRT2, 12);
  });
  it("dragging one handle moves the opposite one according to the type", () => {
    const moved = { x: 3, y: 4 };
    const other = { x: -1, y: 0 };
    expect(constrainOpposite(moved, other, "c")).toEqual(other);
    expect(constrainOpposite(moved, other, "y")).toEqual({ x: -3, y: -4 });
    const s = constrainOpposite(moved, other, "s");
    expect(len(s)).toBeCloseTo(1, 12);
    expect(Math.abs(cross(s, moved))).toBeLessThan(1e-12);
  });
  it("stored node types must match the node count", () => {
    expect(parseNodeTypes("csyc", 4)).toEqual(["c", "s", "y", "c"]);
    expect(parseNodeTypes("csy", 4)).toBeNull();
    expect(parseNodeTypes("cxyc", 4)).toBeNull();
    expect(parseNodeTypes(undefined, 0)).toBeNull();
  });
  it("measures the turn at a node", () => {
    expect(turnAngle({ x: 1, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0, 6);
    expect(turnAngle({ x: 1, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90, 9);
  });
});

describe("dragging a curve", () => {
  it("moves the grabbed point by exactly the pointer movement and leaves the ends alone", () => {
    for (const t of [0.1, 0.3, 0.5, 0.8]) {
      const delta = { x: 0.7, y: -0.25 };
      const o = curveDragOffsets(t, delta);
      const m = 1 - t;
      // Change of B(t) when only the two control points move.
      const dx = 3 * m * m * t * o.first.x + 3 * m * t * t * o.second.x;
      const dy = 3 * m * m * t * o.first.y + 3 * m * t * t * o.second.y;
      expect(dx).toBeCloseTo(delta.x, 12);
      expect(dy).toBeCloseTo(delta.y, 12);
    }
  });
});

describe("add / delete node keeps the shape", () => {
  it("un-splitting gives back the original curve exactly", () => {
    const whole = new ps.Path({ insert: false });
    whole.moveTo(new ps.Point(0, 0));
    whole.cubicCurveTo(new ps.Point(2, 3), new ps.Point(4.5, 3.5), new ps.Point(6, 1));
    const h1 = whole.segments[0].handleOut.length;
    const h2 = whole.segments[1].handleIn.length;
    whole.curves[0].divideAtTime(0.3);
    const [a, mid, c] = whole.segments;
    const r = unsplitHandleLengths(a.handleOut.length, mid.handleIn.length, mid.handleOut.length, c.handleIn.length)!;
    expect(r.alpha).toBeCloseTo(h1, 9);
    expect(r.beta).toBeCloseTo(h2, 9);
    expect(unsplitHandleLengths(1, 0, 2, 1)).toBeNull(); // a straight side: nothing to undo
  });

  it("the fit never returns something worse than the candidates it was given", () => {
    const curve = new ps.Curve(new ps.Point(0, 0), new ps.Point(2, 3), new ps.Point(-1.5, 2.5), new ps.Point(6, 1));
    const samples = [];
    for (let i = 1; i < 16; i++) samples.push({ p: curve.getPointAtTime(i / 16), t: curve.getOffsetAtTime(i / 16) / curve.length });
    const exact = { alpha: curve.handle1.length, beta: curve.handle2.length };
    const r = fitHandleLengths(curve.point1, curve.handle1.normalize(), curve.point2, curve.handle2.normalize(), samples, [exact]);
    expect(r.alpha).toBeCloseTo(exact.alpha, 9);
    expect(r.beta).toBeCloseTo(exact.beta, 9);
    // Without a guess it still returns a usable, positive pair.
    const alone = fitHandleLengths(curve.point1, curve.handle1.normalize(), curve.point2, curve.handle2.normalize(), samples);
    expect(alone.alpha).toBeGreaterThan(0);
    expect(alone.beta).toBeGreaterThan(0);
  });

  it("adding a node does not change the outline at all", () => {
    const leg = legPath();
    const before = leg.clone({ insert: false });
    const { tool, commits } = makeTool();
    tool.restore({ target: { id: "leg", path: [] }, nodes: ["0:1", "0:2", "0:5"] });
    tool.addNodes();
    expect(leg.segments.length).toBe(before.segments.length + 3);
    expect(leg.length).toBeCloseTo(before.length, 9);
    expect(deviation(before, leg)).toBeLessThan(1e-6);
    expect(commits()).toBe(1); // one undo step
    expect(tool.state().selected).toBe(3); // the new nodes are selected
  });

  it("deleting an added node restores the original outline", () => {
    const leg = legPath();
    const before = leg.clone({ insert: false });
    const { tool } = makeTool();
    tool.restore({ target: { id: "leg", path: [] }, nodes: ["0:2"] });
    tool.addNodes();
    tool.deleteNodes();
    expect(leg.segments.length).toBe(before.segments.length);
    expect(deviation(before, leg)).toBeLessThan(1e-6);
    expect(leg.closed).toBe(true);
  });

  it("deleting a node between two straight lines leaves one straight line", () => {
    const tri = new ps.Path({ segments: [[0, 0], [2, 0], [4, 0], [4, 3]], closed: true });
    tri.data.id = "tri";
    const { tool } = makeTool();
    tool.restore({ target: { id: "tri", path: [] }, nodes: ["0:1"] });
    tool.deleteNodes();
    expect(tri.segments.length).toBe(3);
    expect(tri.curves[0].hasHandles()).toBe(false);
    expect(tri.bounds.width).toBe(4);
  });

  it("break apart then join gives back a closed outline of the same shape", () => {
    const leg = legPath();
    const before = leg.clone({ insert: false });
    const { tool } = makeTool();
    tool.restore({ target: { id: "leg", path: [] }, nodes: ["0:2"] });
    tool.breakAtNodes();
    expect(tool.state().open).toBe(true);
    expect(tool.state().canJoin).toBe(true);
    tool.joinEnds(false);
    const st = tool.state();
    expect(st.open).toBe(false);
    expect(st.total).toBe(before.segments.length);
    const now = ps.project.activeLayer.children.find((c) => c.data.id === "leg") as paper.Path;
    expect(deviation(before, now)).toBeLessThan(1e-6);
  });
});

describe("boolean ops (shaping)", () => {
  const rect = (x: number, y: number, w: number, h: number, id: string, fill = "#ff0000") => {
    const r = new ps.Path.Rectangle({ rectangle: new ps.Rectangle(x, y, w, h) });
    r.fillColor = new ps.Color(fill);
    r.data.id = id;
    return r;
  };
  it("weld: result covers exactly the union and takes the last selected shape's fill", () => {
    const a = rect(100, 32, 3, 2, "a", "#ff0000");
    const b = rect(102, 33, 3, 2, "b", "#00ff00");
    const plan = planShaping(ps, [a, b], "weld");
    const r = plan.results[0].item as paper.Path;
    const union = a.bounds.unite(b.bounds);
    expect(r.bounds.x).toBe(union.x);
    expect(r.bounds.y).toBe(union.y);
    expect(r.bounds.width).toBe(union.width);
    expect(r.bounds.height).toBe(union.height);
    expect(Math.abs(r.area)).toBeCloseTo(11, 9);
    expect(r.fillColor?.toCSS(true)).toBe("#00ff00");
    expect(plan.targets).toEqual([b]);
    expect(plan.sources).toEqual([a]);
    // Planning never touches the document.
    expect(ps.project.activeLayer.children.length).toBe(2);
  });
  it("trim: the target keeps its bounds and every original node stays exactly where it was", () => {
    const leg = legPath();
    const nodes = leg.segments.map((s) => `${s.point.x},${s.point.y}`);
    const bounds = leg.bounds.clone();
    const circle = new ps.Path.Ellipse({ rectangle: new ps.Rectangle(5.5, 29.3, 1.2, 1.2) });
    const plan = planShaping(ps, [circle, leg], "trim");
    const r = plan.results[0].item as paper.Path;
    const now = new Set(r.segments.map((s) => `${s.point.x},${s.point.y}`));
    expect(nodes.every((n) => now.has(n))).toBe(true);
    for (const k of ["x", "y", "width", "height"] as const) expect(r.bounds[k]).toBeCloseTo(bounds[k], 9);
    expect(nodeCount(ps, r)).toBeGreaterThan(nodes.length);
  });
  it("intersect, front minus back, back minus front and simplify give the right areas", () => {
    const back = rect(0, 0, 3, 3, "back", "#ff0000");
    const front = rect(1, 1, 3, 3, "front", "#0000ff");
    const area = (op: Parameters<typeof planShaping>[2]) => planShaping(ps, [back, front], op).results.map((r) => Math.abs((r.item as paper.Path).area));
    expect(area("intersect")[0]).toBeCloseTo(4, 9);
    expect(area("front-minus-back")[0]).toBeCloseTo(5, 9);
    expect(area("back-minus-front")[0]).toBeCloseTo(5, 9);
    const s = area("simplify");
    expect(s[0]).toBeCloseTo(5, 9); // the back shape loses what the front one hides
    expect(s[1]).toBeCloseTo(9, 9);
  });
  it("refuses, with a plain message, when the operation can't be done", () => {
    const a = rect(0, 0, 1, 1, "a");
    const far = rect(5, 5, 1, 1, "far");
    expect(() => planShaping(ps, [a, far], "intersect")).toThrow(/don't overlap/);
    expect(() => planShaping(ps, [a], "weld")).toThrow(/two or more/);
    const open = new ps.Path({ segments: [[0, 0], [1, 0], [1, 1]] });
    expect(() => planShaping(ps, [open, a], "trim")).toThrow(/open outline/);
    const text = new ps.PointText({ point: [0, 0], content: "XL" });
    expect(() => planShaping(ps, [text, a], "weld")).toThrow(/Convert the text/);
    const inside = rect(0.25, 0.25, 0.5, 0.5, "inside");
    expect(() => planShaping(ps, [a, inside], "trim")).toThrow(/Nothing would be left/);
  });
  it("shapes touching along one edge weld into a clean rectangle", () => {
    const a = rect(0, 0, 1, 1, "a");
    const b = rect(1, 0, 1, 1, "b");
    const r = planShaping(ps, [a, b], "weld").results[0].item as paper.Path;
    expect(r.segments.length).toBe(4);
    expect(Math.abs(r.area)).toBeCloseTo(2, 12);
  });
});

describe("serialize → deserialize", () => {
  it("gives back the same scene: node count, positions, handles, node types, marks and structure", () => {
    const leg = legPath();
    leg.data.nt = "ccsyccc".slice(0, leg.segments.length);
    const marked = new ps.Path.Rectangle({ rectangle: new ps.Rectangle(1.123456789012, 2, 3, 4) });
    marked.data.shape = "rectangle";
    marked.data.id = "rect";
    marked.strokeColor = new ps.Color("#2b2a29");
    marked.strokeWidth = 0.00762;
    marked.dashArray = [0.15, 0.1];
    const hole = new ps.CompoundPath({ children: [new ps.Path.Circle(new ps.Point(5, 5), 2), new ps.Path.Circle(new ps.Point(5, 5), 1)] });
    hole.fillColor = new ps.Color("#e6e7e8");
    hole.fillRule = "evenodd";
    hole.data.id = "hole";
    const text = new ps.PointText({ point: [3, 4], content: "XL", fontFamily: "Arimo", fontSize: 1.5, fontWeight: "bold" });
    text.fillColor = new ps.Color("#000000");
    const group = new ps.Group({ children: [marked, hole, text] });
    group.data.id = "group";
    group.name = "Size_S";
    group.locked = true;

    const first = [leg, group].map((it) => toNode(ps, it)) as SceneNode[];
    const copies = (JSON.parse(JSON.stringify(first)) as SceneNode[]).map((n) => fromNode(ps, n, () => null)!);
    const second = copies.map((it) => toNode(ps, it));
    expect(second).toEqual(first);

    const legNode = first[0] as PathNode;
    expect(legNode.segs.length).toBe(leg.segments.length);
    expect(legNode.nt).toBe(leg.data.nt);
    expect(legNode.segs[1][0]).toBe(leg.segments[1].point.x); // full float precision, no rounding
    const restored = copies[0] as paper.Path;
    restored.segments.forEach((s, i) => {
      expect(s.point.equals(leg.segments[i].point)).toBe(true);
      expect(s.handleIn.equals(leg.segments[i].handleIn)).toBe(true);
      expect(s.handleOut.equals(leg.segments[i].handleOut)).toBe(true);
    });
    expect(restored.closed).toBe(true);
    expect(pathData(legNode).endsWith("Z")).toBe(true);
  });
  it("bakes a transform into absolute coordinates", () => {
    const p = new ps.Path({ segments: [[0, 0], [1, 0]], applyMatrix: false });
    p.translate(new ps.Point(10, 5));
    const n = toNode(ps, p) as PathNode;
    expect(n.segs[0].slice(0, 2)).toEqual([10, 5]);
    expect(n.segs[1].slice(0, 2)).toEqual([11, 5]);
  });
});

describe("undo history", () => {
  it("keeps the node selection with each step and ignores steps that change nothing", () => {
    const h = new History<string>(3);
    h.reset("a");
    expect(h.push("a", "sel0")).toBe(false);
    expect(h.push("b", "sel1")).toBe(true);
    h.setMeta("sel1-later");
    expect(h.push("c", "sel2")).toBe(true);
    expect(h.undo()).toBe("b");
    expect(h.meta).toBe("sel1-later");
    expect(h.redo()).toBe("c");
    expect(h.meta).toBe("sel2");
    h.push("d");
    h.push("e"); // limit is 3 steps: "a" falls off
    expect(h.undo()).toBe("d");
    expect(h.undo()).toBe("c");
    expect(h.undo()).toBe("b");
    expect(h.canUndo).toBe(false);
  });
});

describe("trace bitmap helpers", () => {
  const image = (w: number, h: number, paint: (x: number, y: number) => [number, number, number, number]): RawImage => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(paint(x, y), (y * w + x) * 4);
    return { width: w, height: h, data };
  };
  it("threshold splits pixels into pure black and white; transparent counts as white", () => {
    const img = image(4, 1, (x) => [[0, 0, 0, 255], [150, 150, 150, 255], [255, 255, 255, 255], [0, 0, 0, 0]][x] as [number, number, number, number]);
    expect([...toBinary(img, 128).data].filter((_, i) => i % 4 === 0)).toEqual([0, 255, 255, 255]);
    expect([...toBinary(img, 200).data].filter((_, i) => i % 4 === 0)).toEqual([0, 0, 255, 255]);
  });
  it("picks the dominant flat colours, most common first, the same way every time", () => {
    const img = image(30, 10, (x) => (x < 15 ? [255, 255, 255, 255] : x < 25 ? [210, 31, 60, 255] : [31, 79, 210, 255]));
    const p = pickPalette(img, 3);
    expect(p).toEqual([[255, 255, 255, 255], [210, 31, 60, 255], [31, 79, 210, 255]]);
    expect(pickPalette(img, 3)).toEqual(p);
    expect(isNearWhite(p[0])).toBe(true);
    expect(isNearWhite(p[1])).toBe(false);
  });
  it("tells flat artwork from a photograph", () => {
    const flat = image(40, 40, (x, y) => (x < 20 ? [0, 0, 0, 255] : y < 20 ? [255, 255, 255, 255] : [200, 30, 30, 255]));
    const photo = image(64, 64, (x, y) => [(x * 4) % 256, (y * 4) % 256, ((x + y) * 2) % 256, 255]);
    expect(looksPhotographic(flat)).toBe(false);
    expect(looksPhotographic(photo)).toBe(true);
  });
  it("more smoothing loosens the fit; more detail keeps smaller specks", () => {
    const a = tracerNumbers({ ...DEFAULT_TRACE, smoothing: 0, detail: 100 }, 1);
    const b = tracerNumbers({ ...DEFAULT_TRACE, smoothing: 100, detail: 0 }, 1);
    expect(b.fit).toBeGreaterThan(a.fit);
    expect(a.minPath).toBe(0);
    expect(b.minPath).toBeGreaterThan(a.minPath);
  });
});
