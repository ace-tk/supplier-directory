// Paper.js items <-> our own JSON scene nodes. All numbers are inches, in
// project space (y down), stored at full float precision so save → load is
// exact. Rasters are stored as a reference to their asset (the original
// file), never as pixel data, which keeps undo snapshots and saves cheap.

import type paper from "paper/dist/paper-core";

/** [x, y, handleIn.x, handleIn.y, handleOut.x, handleOut.y] — handles relative to the point. */
export type Seg = [number, number, number, number, number, number];

export interface StyleJSON {
  fill?: string | null;
  stroke?: string | null;
  strokeWidth?: number;
  dash?: number[];
  cap?: string;
  join?: string;
  miter?: number;
  opacity?: number;
  fillRule?: string;
}

interface NodeBase {
  id?: string;
  name?: string;
  hidden?: boolean;
  locked?: boolean;
  clipMask?: boolean;
  style?: StyleJSON;
}

export interface PathNode extends NodeBase {
  t: "path";
  closed: boolean;
  segs: Seg[];
}
export interface CompoundNode extends NodeBase {
  t: "compound";
  children: PathNode[];
}
export interface GroupNode extends NodeBase {
  t: "group";
  clipped?: boolean;
  children: SceneNode[];
}
export interface TextNode extends NodeBase {
  t: "text";
  content: string;
  matrix: number[];
  fontFamily: string;
  fontWeight: string | number;
  /** Inches. */
  fontSize: number;
  justification: string;
}
export interface RasterNode extends NodeBase {
  t: "raster";
  assetId: string;
  matrix: number[];
  /** The proxy's pixel size the matrix was computed against. */
  width: number;
  height: number;
}

export type SceneNode = PathNode | CompoundNode | GroupNode | TextNode | RasterNode;

type PaperScope = typeof paper;
type Item = paper.Item;

function colorToCss(c: paper.Color | null | undefined): string | null {
  if (!c) return null;
  if (c.type === "gradient") {
    // Phase 1 keeps gradients as their first stop colour (not used by pattern files).
    const stop = c.gradient?.stops?.[0];
    return stop ? colorToCss(stop.color) : null;
  }
  return c.alpha < 1 ? c.toCSS(false) : c.toCSS(true);
}

function styleOf(item: Item): StyleJSON {
  const s: StyleJSON = {
    fill: colorToCss(item.fillColor),
    stroke: colorToCss(item.strokeColor),
  };
  if (item.strokeColor) {
    s.strokeWidth = item.strokeWidth;
    if (item.dashArray?.length) s.dash = [...item.dashArray];
    if (item.strokeCap && item.strokeCap !== "butt") s.cap = item.strokeCap;
    if (item.strokeJoin && item.strokeJoin !== "miter") s.join = item.strokeJoin;
    if (item.miterLimit !== 10) s.miter = item.miterLimit;
  }
  if (item.opacity !== 1) s.opacity = item.opacity;
  const fillRule = (item as paper.Path).fillRule;
  if (fillRule && fillRule !== "nonzero") s.fillRule = fillRule;
  return s;
}

function applyStyle(ps: PaperScope, item: Item, s: StyleJSON | undefined) {
  if (!s) return;
  item.fillColor = s.fill ? new ps.Color(s.fill) : null;
  item.strokeColor = s.stroke ? new ps.Color(s.stroke) : null;
  if (s.strokeWidth !== undefined) item.strokeWidth = s.strokeWidth;
  if (s.dash) item.dashArray = s.dash;
  if (s.cap) item.strokeCap = s.cap;
  if (s.join) item.strokeJoin = s.join;
  if (s.miter !== undefined) item.miterLimit = s.miter;
  if (s.opacity !== undefined) item.opacity = s.opacity;
  if (s.fillRule) (item as paper.Path).fillRule = s.fillRule;
}

function baseOf(item: Item): NodeBase {
  const b: NodeBase = {};
  if (item.data?.id) b.id = item.data.id;
  if (item.name) b.name = item.name;
  if (!item.visible) b.hidden = true;
  if (item.locked) b.locked = true;
  if (item.clipMask) b.clipMask = true;
  return b;
}

function applyBase(item: Item, n: NodeBase) {
  if (n.id) item.data.id = n.id;
  if (n.name) item.name = n.name;
  if (n.hidden) item.visible = false;
  if (n.locked) item.locked = true;
  if (n.clipMask) item.clipMask = true;
}

function pathNode(p: paper.Path): PathNode {
  const m = p.matrix.isIdentity() ? null : p.matrix;
  const segs: Seg[] = p.segments.map((sg) => {
    if (!m) return [sg.point.x, sg.point.y, sg.handleIn.x, sg.handleIn.y, sg.handleOut.x, sg.handleOut.y];
    // Bake any matrix into absolute geometry.
    const pt = m.transform(sg.point);
    const hi = m.transform(sg.point.add(sg.handleIn)).subtract(pt);
    const ho = m.transform(sg.point.add(sg.handleOut)).subtract(pt);
    return [pt.x, pt.y, hi.x, hi.y, ho.x, ho.y];
  });
  return { t: "path", ...baseOf(p), style: styleOf(p), closed: p.closed, segs };
}

/** Serializes one item (and its children). Unknown item types are skipped. */
export function toNode(ps: PaperScope, item: Item): SceneNode | null {
  if (item instanceof ps.CompoundPath) {
    return {
      t: "compound",
      ...baseOf(item),
      style: styleOf(item),
      children: (item.children as paper.Path[]).filter((c) => c instanceof ps.Path).map(pathNode),
    };
  }
  if (item instanceof ps.Path) return pathNode(item);
  if (item instanceof ps.Group) {
    const children = item.children.map((c) => toNode(ps, c)).filter((c): c is SceneNode => !!c);
    const g: GroupNode = { t: "group", ...baseOf(item), children };
    if (item.clipped) g.clipped = true;
    return g;
  }
  if (item instanceof ps.PointText) {
    return {
      t: "text",
      ...baseOf(item),
      style: styleOf(item),
      content: item.content,
      matrix: item.matrix.values,
      fontFamily: item.fontFamily,
      fontWeight: item.fontWeight,
      fontSize: Number(item.fontSize),
      justification: item.justification,
    };
  }
  if (item instanceof ps.Raster && item.data?.assetId) {
    return {
      t: "raster",
      ...baseOf(item),
      assetId: item.data.assetId,
      matrix: item.matrix.values,
      width: item.width,
      height: item.height,
    };
  }
  return null;
}

/** Builds a raster's display proxy synchronously (a canvas made from the asset). */
export type ProxyResolver = (assetId: string) => HTMLCanvasElement | null;

/** Deserializes a node. Items are created with insert:false — the caller inserts them. */
export function fromNode(ps: PaperScope, n: SceneNode, resolveProxy: ProxyResolver): Item | null {
  let item: Item | null = null;
  switch (n.t) {
    case "path": {
      const p = new ps.Path({ insert: false });
      p.segments = n.segs.map((s) => new ps.Segment(new ps.Point(s[0], s[1]), new ps.Point(s[2], s[3]), new ps.Point(s[4], s[5])));
      p.closed = n.closed;
      applyStyle(ps, p, n.style);
      item = p;
      break;
    }
    case "compound": {
      const cp = new ps.CompoundPath({ insert: false });
      for (const child of n.children) {
        const c = fromNode(ps, child, resolveProxy);
        if (c) cp.addChild(c);
      }
      applyStyle(ps, cp, n.style);
      item = cp;
      break;
    }
    case "group": {
      const g = new ps.Group({ insert: false });
      for (const child of n.children) {
        const c = fromNode(ps, child, resolveProxy);
        if (c) g.addChild(c);
      }
      if (n.clipped) g.clipped = true;
      item = g;
      break;
    }
    case "text": {
      const t = new ps.PointText({ insert: false });
      t.content = n.content;
      t.fontFamily = n.fontFamily;
      t.fontWeight = n.fontWeight;
      t.fontSize = n.fontSize;
      t.justification = n.justification;
      applyStyle(ps, t, n.style);
      t.matrix = new ps.Matrix(n.matrix);
      item = t;
      break;
    }
    case "raster": {
      const proxy = resolveProxy(n.assetId);
      if (!proxy) return null;
      const r = new ps.Raster({ insert: false });
      r.image = proxy;
      const m = new ps.Matrix(n.matrix);
      // If the proxy was rebuilt at a different pixel size, keep the same real size.
      if (proxy.width !== n.width || proxy.height !== n.height) m.scale(n.width / proxy.width, n.height / proxy.height);
      r.matrix = m;
      r.data.assetId = n.assetId;
      item = r;
      break;
    }
  }
  if (item) applyBase(item, n);
  return item;
}

/** Collects every asset id referenced by a node tree. */
export function collectAssetIds(nodes: SceneNode[], into = new Set<string>()): Set<string> {
  for (const n of nodes) {
    if (n.t === "raster") into.add(n.assetId);
    else if (n.t === "group") collectAssetIds(n.children, into);
  }
  return into;
}

/** SVG path data for a path node (absolute, inches). */
export function pathData(n: PathNode, precision = 6): string {
  const f = (v: number) => {
    const s = v.toFixed(precision);
    return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
  };
  const segs = n.segs;
  if (segs.length === 0) return "";
  let d = `M${f(segs[0][0])},${f(segs[0][1])}`;
  const count = n.closed ? segs.length : segs.length - 1;
  for (let i = 0; i < count; i++) {
    const a = segs[i];
    const b = segs[(i + 1) % segs.length];
    const straight = a[4] === 0 && a[5] === 0 && b[2] === 0 && b[3] === 0;
    if (straight) d += `L${f(b[0])},${f(b[1])}`;
    else d += `C${f(a[0] + a[4])},${f(a[1] + a[5])} ${f(b[0] + b[2])},${f(b[1] + b[3])} ${f(b[0])},${f(b[1])}`;
  }
  if (n.closed) d += "Z";
  return d;
}
