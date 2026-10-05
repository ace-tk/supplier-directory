import type paper from "paper/dist/paper-core";
import { constrainOpposite, curveDragOffsets, fitHandleLengths, inferNodeType, parseNodeTypes, smoothedHandles, turnAngle, type NodeType } from "./node-geometry";
import { SNAP_PX, snapPoints, type SnapTargets } from "./snap";

type Item = paper.Item;
type Rect = { x: number; y: number; w: number; h: number };
/** What the Shape tool edits: one curve, or a compound path (outline + holes). */
type EditTarget = paper.Path | paper.CompoundPath;

// Screen-pixel sizes — constant at every zoom level.
const NODE_PX = 7;
const START_NODE_PX = 9;
const NODE_HIT_PX = 6;
const HANDLE_PX = 5;
const PATH_HIT_PX = 6;
const DRAG_START_PX = 3;
const NODE_COLOR = "#2563eb";
const PREVIEW_COLOR = "#d946ef";
/** Simplify keeps any node that turns sharper than this as a corner. */
const CORNER_DEG = 30;
export const DEFAULT_SIMPLIFY_TOLERANCE = 0.01; // inches

export const CONVERT_HINT = "Convert to curves (Ctrl+Q) to edit nodes";

/** Where an item lives: its top-level object's id, then child indices down to it. Survives undo's rebuild. */
export interface ItemAddress {
  id: string;
  path: number[];
}

/** Node selection stored with each undo step ("subpath:index" keys). */
export interface ShapeMeta {
  target: ItemAddress | null;
  nodes: string[];
  /** Selected segments, keyed by the node they start at. */
  segs?: string[];
}

export interface NodeEditState {
  hasTarget: boolean;
  /** Set when the clicked object has no editable nodes (text, rectangle, ellipse, bitmap). */
  hint: string | null;
  total: number;
  selected: number;
  subpaths: number;
  /** True if any subpath of the edited object is open. */
  open: boolean;
  /** The single selected node, page space (inches, y down). */
  point: { x: number; y: number } | null;
  /** Bounding box of 2+ selected nodes, page space. */
  bounds: Rect | null;
  /** Type shared by the selected nodes, "mixed" if they differ, null if none are selected. */
  nodeType: NodeType | "mixed" | null;
  /** Segments the To line / To curve buttons act on, and whether any is a curve / a line. */
  segments: number;
  hasCurve: boolean;
  hasLine: boolean;
  /** Total length of those segments, inches. */
  segmentLength: number | null;
  /** Selected nodes that are the loose end of an open path. */
  openEnds: number;
  /** Exactly two loose ends are selected (they can be joined). */
  canJoin: boolean;
  /** A selected node can be split (it is not already a loose end). */
  canBreak: boolean;
  /** Reduce-nodes preview: nothing is changed until it is applied. */
  simplify: { tolerance: number; before: number; after: number } | null;
}

/** An open path found by "Check outlines". */
export interface OpenPathInfo {
  address: ItemAddress;
  /** Name (or kind) of the top-level object it belongs to. */
  label: string;
  nodes: number;
  /** Distance between its two loose ends, inches. */
  gap: number;
}

/** The slice of the Editor the Shape tool needs. */
export interface ShapeHost {
  ps: paper.PaperScope;
  contentLayer: () => paper.Layer;
  /** Inches per screen pixel. */
  px: () => number;
  topLevel: (item: Item | null) => Item | null;
  idOf: (item: Item) => string;
  snapTargets: (skip: Set<paper.Segment>, excludeBounds: Item | null) => SnapTargets;
  setSnap: (label: string | null, at: { x: number; y: number } | null) => void;
  setMarquee: (r: paper.Rectangle | null) => void;
  /** Keeps the object-level selection in step with the edited object. */
  selectTop: (item: Item | null) => void;
  /** Records one undo step. */
  commit: () => void;
  /** Redraw + re-render without an undo step. */
  changed: () => void;
  /** Node selection changed without a document change. */
  selectionChanged: () => void;
}

type HandleSide = "in" | "out";
type CurveHit = { sub: number; index: number; curve: paper.Curve; time: number };

type ShapeDrag =
  | { kind: "nodes"; start: paper.Point; anchor: paper.Point; starts: Map<paper.Segment, paper.Point>; moved: boolean; targets: SnapTargets }
  | { kind: "marquee"; start: paper.Point; additive: boolean; moved: boolean; clickSeg: string | null }
  | { kind: "handle"; seg: paper.Segment; side: HandleSide; grab: paper.Point; moved: boolean }
  | { kind: "curve"; start: paper.Point; hit: CurveHit; h1: paper.Point; h2: paper.Point; moved: boolean; additive: boolean };

const key = (sub: number, index: number) => `${sub}:${index}`;

/**
 * CorelDRAW-style Shape tool (F10): shows and edits the nodes of one curve.
 * Geometry stays in inches at full precision; node markers and hit areas
 * are sized in screen pixels. Markers are drawn straight onto a 2D overlay
 * canvas (not as Paper items) so thousands of nodes stay cheap.
 */
export class ShapeTool {
  private target: EditTarget | null = null;
  private address: ItemAddress | null = null;
  /** The curve edited last, so Space/Esc back to the Pick tool and in again returns to it. */
  private lastAddress: ItemAddress | null = null;
  private hint: string | null = null;
  /** The object the hint is about (what Ctrl+Q would convert). */
  private hintItem: Item | null = null;
  private nodes = new Set<string>();
  /** Selected segments: "subpath:index" of the node each one starts at. */
  private segs = new Set<string>();
  private drag: ShapeDrag | null = null;
  private marqueeEnd: paper.Point | null = null;
  private preview: { tolerance: number; before: number; paths: paper.Path[] } | null = null;

  constructor(private host: ShapeHost) {}

  // ---------------------------------------------------------------- target
  private isCompound(item: Item): boolean {
    return item instanceof this.host.ps.CompoundPath;
  }

  private paths(): paper.Path[] {
    const t = this.target;
    if (!t) return [];
    return this.isCompound(t) ? (t.children as paper.Path[]).filter((c) => c instanceof this.host.ps.Path) : [t as paper.Path];
  }

  private addressOf(item: Item): ItemAddress | null {
    const path: number[] = [];
    let it: Item = item;
    const layer = this.host.contentLayer();
    while (it.parent && it.parent !== layer) {
      path.unshift(it.index);
      it = it.parent;
    }
    if (it.parent !== layer) return null;
    return { id: this.host.idOf(it), path };
  }

  private resolve(address: ItemAddress): Item | null {
    let it: Item | undefined = this.host.contentLayer().children.find((c) => c.data.id === address.id);
    for (const i of address.path) it = it?.children?.[i];
    return it ?? null;
  }

  /** Why an item can't be node-edited, or null if it can. */
  private hintFor(item: Item): string | null {
    const ps = this.host.ps;
    if (item instanceof ps.PointText) return CONVERT_HINT;
    if (item instanceof ps.Raster) return "A bitmap has no nodes to edit";
    if (item instanceof ps.Path && item.data?.shape) return CONVERT_HINT;
    if (item instanceof ps.Path || item instanceof ps.CompoundPath) return null;
    return "Click a curve inside this group to edit its nodes";
  }

  /** Starts editing an object (or shows why it can't be edited). */
  enter(item: Item | null) {
    this.preview = null;
    this.nodes.clear();
    this.segs.clear();
    this.drag = null;
    this.target = null;
    this.address = null;
    this.hint = null;
    this.hintItem = null;
    if (item) {
      if (item.parent && this.isCompound(item.parent)) item = item.parent;
      const lastAddress = this.lastAddress;
      if (lastAddress && item instanceof this.host.ps.Group && lastAddress.id === item.data.id) {
        const last = this.resolve(lastAddress);
        if (last && !this.hintFor(last)) item = last;
      }
      this.hint = this.hintFor(item);
      this.hintItem = this.hint ? item : null;
      if (!this.hint) {
        this.target = item as EditTarget;
        this.address = this.addressOf(item);
      }
      this.host.selectTop(this.host.topLevel(item));
    }
    this.host.selectionChanged();
  }

  clear() {
    if (this.target && this.address) this.lastAddress = this.address;
    this.preview = null;
    this.nodes.clear();
    this.segs.clear();
    this.drag = null;
    this.target = null;
    this.address = null;
    this.hint = null;
    this.hintItem = null;
  }

  /** After the scene was rebuilt or changed by another command: re-find the edited object. */
  validate() {
    if (!this.target) return;
    if (this.target.isInserted() && this.host.topLevel(this.target)) return;
    const found = this.address ? this.resolve(this.address) : null;
    if (found && !this.hintFor(found)) {
      this.target = found as EditTarget;
      this.pruneNodes();
    } else {
      this.clear();
    }
  }

  private pruneNodes() {
    const paths = this.paths();
    for (const k of [...this.nodes]) {
      const [s, i] = k.split(":").map(Number);
      if (!paths[s] || i >= paths[s].segments.length) this.nodes.delete(k);
    }
    for (const k of [...this.segs]) {
      const [s, i] = k.split(":").map(Number);
      if (!paths[s] || i >= paths[s].curves.length) this.segs.delete(k);
    }
  }

  meta(): ShapeMeta {
    return { target: this.target ? this.address : null, nodes: [...this.nodes], segs: [...this.segs] };
  }

  /** Undo/redo: restore exactly the node selection saved with that step. */
  restore(meta: ShapeMeta | null) {
    this.clear();
    if (!meta?.target) return;
    const found = this.resolve(meta.target);
    if (!found || this.hintFor(found)) return;
    this.target = found as EditTarget;
    this.address = meta.target;
    this.nodes = new Set(meta.nodes);
    this.segs = new Set(meta.segs ?? []);
    this.pruneNodes();
    this.host.selectTop(this.host.topLevel(found));
  }

  // ---------------------------------------------------------------- geometry
  /** Node position in page space, even if the path carries a transform. */
  private pagePoint(seg: paper.Segment): paper.Point {
    const m = seg.path.globalMatrix;
    return m.isIdentity() ? seg.point : m.transform(seg.point);
  }

  private setPagePoint(seg: paper.Segment, p: paper.Point) {
    const m = seg.path.globalMatrix;
    seg.point = m.isIdentity() ? p : m.inverseTransform(p);
  }

  private selectedSegments(): paper.Segment[] {
    const paths = this.paths();
    const out: paper.Segment[] = [];
    for (const k of this.nodes) {
      const [s, i] = k.split(":").map(Number);
      const seg = paths[s]?.segments[i];
      if (seg) out.push(seg);
    }
    return out;
  }

  /** Handle tip in page space. */
  private handlePoint(seg: paper.Segment, side: HandleSide): paper.Point {
    const local = seg.point.add(side === "in" ? seg.handleIn : seg.handleOut);
    const m = seg.path.globalMatrix;
    return m.isIdentity() ? local : m.transform(local);
  }

  private setHandlePoint(seg: paper.Segment, side: HandleSide, page: paper.Point) {
    const m = seg.path.globalMatrix;
    const h = (m.isIdentity() ? page : m.inverseTransform(page)).subtract(seg.point);
    if (side === "in") seg.handleIn = h;
    else seg.handleOut = h;
  }

  // ---------------------------------------------------------------- node types
  /** Node types of a path: stored on the path once set, otherwise worked out from the handles. */
  private typesOf(path: paper.Path): NodeType[] {
    return parseNodeTypes(path.data?.nt, path.segments.length) ?? path.segments.map((s) => inferNodeType(s.handleIn, s.handleOut));
  }

  private typeOf(seg: paper.Segment): NodeType {
    return this.typesOf(seg.path)[seg.index];
  }

  private setType(seg: paper.Segment, type: NodeType) {
    const types = this.typesOf(seg.path);
    types[seg.index] = type;
    seg.path.data.nt = types.join("");
  }

  /** Keeps the handle opposite the one that moved in line with the node's type. */
  private constrain(seg: paper.Segment, moved: HandleSide) {
    const type = this.typeOf(seg);
    if (type === "c") return;
    const ps = this.host.ps;
    if (moved === "in") seg.handleOut = new ps.Point(constrainOpposite(seg.handleIn, seg.handleOut, type));
    else seg.handleIn = new ps.Point(constrainOpposite(seg.handleOut, seg.handleIn, type));
  }

  // ---------------------------------------------------------------- segments
  private selectedCurves(): paper.Curve[] {
    const paths = this.paths();
    const out: paper.Curve[] = [];
    for (const k of this.segs) {
      const [s, i] = k.split(":").map(Number);
      const c = paths[s]?.curves[i];
      if (c) out.push(c);
    }
    return out;
  }

  /** Segments the line/curve commands act on: the selected ones, else (like Corel) the one leading into each selected node. */
  private actionCurves(): paper.Curve[] {
    const chosen = this.selectedCurves();
    if (chosen.length) return chosen;
    const out: paper.Curve[] = [];
    for (const seg of this.selectedSegments()) {
      const c = seg.previous ? seg.previous.curve : null;
      if (c && c.segment2 === seg && !out.includes(c)) out.push(c);
    }
    return out;
  }

  /** Nodes whose handles are shown: the selected nodes, their neighbours' facing handles, and both ends of selected segments. */
  private shownHandles(): { seg: paper.Segment; side: HandleSide }[] {
    const out: { seg: paper.Segment; side: HandleSide }[] = [];
    const seen = new Set<string>();
    const add = (seg: paper.Segment | null, side: HandleSide) => {
      if (!seg) return;
      const h = side === "in" ? seg.handleIn : seg.handleOut;
      if (h.isZero()) return;
      const k = `${seg.path.id}:${seg.index}:${side}`;
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ seg, side });
    };
    for (const seg of this.selectedSegments()) {
      add(seg, "in");
      add(seg, "out");
      add(seg.previous, "out");
      add(seg.next, "in");
    }
    for (const c of this.selectedCurves()) {
      add(c.segment1, "out");
      add(c.segment2, "in");
    }
    return out;
  }

  private hitHandle(viewPoint: paper.Point): { seg: paper.Segment; side: HandleSide; d: number } | null {
    const view = this.host.ps.view;
    let best: { seg: paper.Segment; side: HandleSide; d: number } | null = null;
    for (const h of this.shownHandles()) {
      const d = view.projectToView(this.handlePoint(h.seg, h.side)).getDistance(viewPoint);
      if (d <= NODE_HIT_PX && (!best || d < best.d)) best = { ...h, d };
    }
    return best;
  }

  /** The point on the edited object's own outline under the pointer, if any. */
  private hitCurve(p: paper.Point): CurveHit | null {
    const tol = PATH_HIT_PX * this.host.px();
    let best: (CurveHit & { d: number }) | null = null;
    this.paths().forEach((path, sub) => {
      const m = path.globalMatrix;
      const local = m.isIdentity() ? p : m.inverseTransform(p);
      const loc = path.getNearestLocation(local);
      if (!loc?.curve) return;
      const d = loc.point.getDistance(local);
      if (d <= tol && (!best || d < best.d)) best = { sub, index: loc.curve.index, curve: loc.curve, time: loc.time, d };
    });
    return best;
  }

  private hitNode(viewPoint: paper.Point): { key: string; seg: paper.Segment } | null {
    const view = this.host.ps.view;
    const zoom = view.zoom;
    const tl = view.bounds.topLeft;
    let best: { key: string; seg: paper.Segment } | null = null;
    let bestD = NODE_HIT_PX + NODE_PX / 2;
    this.paths().forEach((path, s) => {
      path.segments.forEach((seg, i) => {
        const p = this.pagePoint(seg);
        const d = Math.max(Math.abs((p.x - tl.x) * zoom - viewPoint.x), Math.abs((p.y - tl.y) * zoom - viewPoint.y));
        // Selected nodes win ties so a stack of nodes drags the one you picked.
        if (d < bestD || (d === bestD && this.nodes.has(key(s, i)))) {
          bestD = d;
          best = { key: key(s, i), seg };
        }
      });
    });
    return best;
  }

  /**
   * The curve under the pointer (drills into groups), or a non-editable
   * object. When several outlines are within reach (e.g. a cut line and its
   * stitch line), the one nearest the pointer wins, not the topmost.
   */
  private hitObject(p: paper.Point): Item | null {
    const ps = this.host.ps;
    const hits = this.host.contentLayer().hitTestAll(p, {
      fill: true,
      stroke: true,
      segments: false,
      tolerance: PATH_HIT_PX * this.host.px(),
      match: (h: paper.HitResult) => {
        const top = this.host.topLevel(h.item);
        return !!top && top.visible && !top.locked;
      },
    });
    if (!hits.length) return null;
    // Text or a bitmap on top is what was clicked, even if an outline passes behind it.
    if (!(hits[0].item instanceof ps.Path)) return hits[0].item;
    let best = hits[0].item;
    let bestD = Infinity;
    for (const h of hits) {
      if (!(h.item instanceof ps.Path)) continue;
      const d = h.item.getNearestPoint(p).getDistance(p);
      if (d < bestD) {
        bestD = d;
        best = h.item;
      }
    }
    return best.parent && this.isCompound(best.parent) ? best.parent : best;
  }

  // ---------------------------------------------------------------- pointer
  /** Returns true if a drag started (the Editor then routes move/up here). */
  pointerDown(e: PointerEvent, vp: paper.Point, p: paper.Point): boolean {
    // While a simplify preview is showing, the outline is frozen until Apply or Cancel.
    if (this.preview) return false;
    const handle = this.hitHandle(vp);
    if (handle) {
      this.drag = { kind: "handle", seg: handle.seg, side: handle.side, grab: this.handlePoint(handle.seg, handle.side).subtract(p), moved: false };
      return true;
    }
    const node = this.hitNode(vp);
    if (node) {
      if (!e.shiftKey) this.segs.clear();
      if (e.shiftKey) {
        if (this.nodes.has(node.key)) {
          this.nodes.delete(node.key);
          this.host.selectionChanged();
          this.host.changed();
          return false;
        }
        this.nodes.add(node.key);
      } else if (!this.nodes.has(node.key)) {
        this.nodes = new Set([node.key]);
      }
      this.host.selectionChanged();
      const moving = this.selectedSegments();
      const starts = new Map<paper.Segment, paper.Point>();
      for (const s of moving) starts.set(s, this.pagePoint(s).clone());
      this.drag = {
        kind: "nodes",
        start: p,
        anchor: this.pagePoint(node.seg).clone(),
        starts,
        moved: false,
        targets: this.host.snapTargets(new Set(moving), this.target ? this.host.topLevel(this.target) : null),
      };
      this.host.changed();
      return true;
    }
    // The edited object's own outline: drag a curve to bend it, click to select the segment.
    const onCurve = this.hitCurve(p);
    if (onCurve) {
      if (onCurve.curve.hasHandles()) {
        this.drag = { kind: "curve", start: p, hit: onCurve, h1: onCurve.curve.handle1.clone(), h2: onCurve.curve.handle2.clone(), moved: false, additive: e.shiftKey };
      } else {
        // A straight line can't be bent until it is converted to a curve: dragging from it just draws a marquee.
        this.drag = { kind: "marquee", start: p, additive: e.shiftKey, moved: false, clickSeg: key(onCurve.sub, onCurve.index) };
      }
      return true;
    }
    const hit = this.hitObject(p);
    if (hit && hit !== this.target) {
      this.enter(hit);
      this.host.changed();
      return false;
    }
    this.drag = { kind: "marquee", start: p, additive: e.shiftKey, moved: false, clickSeg: null };
    return true;
  }

  private clickSegment(k: string, additive: boolean) {
    if (!additive) {
      this.nodes.clear();
      this.segs = new Set([k]);
    } else if (this.segs.has(k)) this.segs.delete(k);
    else this.segs.add(k);
  }

  pointerMove(e: PointerEvent, p: paper.Point) {
    const d = this.drag;
    if (!d) return;
    const ps = this.host.ps;
    if (d.kind === "marquee") {
      if (!d.moved && p.subtract(d.start).length / this.host.px() < DRAG_START_PX) return;
      d.moved = true;
      this.marqueeEnd = p;
      this.host.setMarquee(new ps.Rectangle(d.start, p));
      return;
    }
    if (d.kind === "handle") {
      // Pin the node types down before the handles change, so a type is never re-guessed from a half-edited shape.
      if (!d.moved) this.setType(d.seg, this.typeOf(d.seg));
      d.moved = true;
      this.setHandlePoint(d.seg, d.side, p.add(d.grab));
      this.constrain(d.seg, d.side);
      return;
    }
    if (d.kind === "curve") {
      const move = p.subtract(d.start);
      if (!d.moved && move.length / this.host.px() < DRAG_START_PX) return;
      const c = d.hit.curve;
      if (!d.moved) this.setType(c.segment1, this.typeOf(c.segment1));
      d.moved = true;
      const m = c.path.globalMatrix;
      // Offsets are vectors: take the matrix's linear part only.
      const local = m.isIdentity() ? move : m.inverseTransform(move).subtract(m.inverseTransform(new ps.Point(0, 0)));
      const o = curveDragOffsets(d.hit.time, local);
      c.handle1 = d.h1.add(new ps.Point(o.first));
      c.handle2 = d.h2.add(new ps.Point(o.second));
      this.constrain(c.segment1, "out");
      this.constrain(c.segment2, "in");
      return;
    }
    let delta = p.subtract(d.start);
    if (!d.moved && delta.length / this.host.px() < DRAG_START_PX) return;
    d.moved = true;
    if (e.ctrlKey || e.metaKey) delta = Math.abs(delta.x) >= Math.abs(delta.y) ? new ps.Point(delta.x, 0) : new ps.Point(0, delta.y);
    // Snap the node under the pointer; the rest of the selection follows by the same offset.
    const r = snapPoints([d.anchor.add(delta)], d.targets, SNAP_PX * this.host.px());
    if (r.label) {
      delta = delta.add(new ps.Point(r.dx, r.dy));
      this.host.setSnap(r.label, r.at);
    }
    for (const [seg, start] of d.starts) this.setPagePoint(seg, start.add(delta));
  }

  pointerUp(e: PointerEvent) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (d.kind === "nodes" || d.kind === "handle") {
      if (d.moved) this.host.commit();
      return;
    }
    if (d.kind === "curve") {
      if (d.moved) this.host.commit();
      else {
        this.clickSegment(key(d.hit.sub, d.hit.index), d.additive);
        this.host.selectionChanged();
      }
      return;
    }
    const ps = this.host.ps;
    if (d.moved) {
      const r = new ps.Rectangle(d.start, this.marqueeEnd ?? d.start);
      const next = d.additive ? new Set(this.nodes) : new Set<string>();
      if (!d.additive) this.segs.clear();
      this.paths().forEach((path, s) => path.segments.forEach((seg, i) => r.contains(this.pagePoint(seg)) && next.add(key(s, i))));
      this.nodes = next;
    } else if (d.clickSeg) {
      this.clickSegment(d.clickSeg, d.additive);
    } else if (!e.shiftKey) {
      // Plain click on nothing: drop the node/segment selection first, then the object.
      if (this.nodes.size || this.segs.size) {
        this.nodes.clear();
        this.segs.clear();
      }
      else if (!this.hitObject(d.start)) {
        this.host.selectTop(null);
        this.enter(null);
      }
    }
    this.marqueeEnd = null;
    this.host.setMarquee(null);
    this.host.selectionChanged();
  }

  cursorAt(vp: paper.Point): string {
    return this.hitHandle(vp) ? "crosshair" : this.hitNode(vp) ? "move" : "default";
  }

  // ---------------------------------------------------------------- commands
  selectAll() {
    if (!this.target) return;
    this.nodes.clear();
    this.paths().forEach((path, s) => path.segments.forEach((_, i) => this.nodes.add(key(s, i))));
    this.host.selectionChanged();
    this.host.changed();
  }

  /** Esc: clears the node selection. Returns false when there was nothing to clear. */
  escape(): boolean {
    if (this.preview) {
      this.cancelSimplify();
      return true;
    }
    if (!this.nodes.size && !this.segs.size) return false;
    this.nodes.clear();
    this.segs.clear();
    this.host.selectionChanged();
    this.host.changed();
    return true;
  }

  /** Moves the selected nodes by an exact page-space offset (one undo step). */
  translateNodes(dx: number, dy: number): boolean {
    const segs = this.selectedSegments();
    if (!segs.length || (!dx && !dy)) return false;
    const d = new this.host.ps.Point(dx, dy);
    for (const s of segs) this.setPagePoint(s, this.pagePoint(s).add(d));
    this.host.commit();
    return true;
  }

  /** Sets the single selected node's exact page position. */
  setNodePoint(patch: { x?: number; y?: number }) {
    const segs = this.selectedSegments();
    if (segs.length !== 1) return;
    const cur = this.pagePoint(segs[0]);
    this.setPagePoint(segs[0], new this.host.ps.Point(patch.x ?? cur.x, patch.y ?? cur.y));
    this.host.commit();
  }

  /** C / S / Y: makes the selected nodes cusp, smooth or symmetrical (one undo step). */
  setNodeType(type: NodeType) {
    const segs = this.selectedSegments();
    if (!segs.length) return;
    const ps = this.host.ps;
    for (const seg of segs) {
      if (type !== "c") {
        const toPrev = seg.previous ? seg.previous.point.subtract(seg.point) : null;
        const toNext = seg.next ? seg.next.point.subtract(seg.point) : null;
        const h = smoothedHandles(seg.handleIn, seg.handleOut, toPrev, toNext, type === "y");
        seg.handleIn = new ps.Point(h.handleIn);
        seg.handleOut = new ps.Point(h.handleOut);
      }
      this.setType(seg, type);
    }
    this.host.commit();
  }

  /** To line / To curve for the selected segments (or the segment leading into each selected node). */
  convertSegments(to: "line" | "curve") {
    const curves = this.actionCurves();
    let changed = false;
    for (const c of curves) {
      if (to === "line" && c.hasHandles()) {
        c.clearHandles();
        // A node with a straight side can no longer be smooth.
        this.setType(c.segment1, "c");
        this.setType(c.segment2, "c");
        changed = true;
      } else if (to === "curve" && !c.hasHandles()) {
        // Handles a third of the way along: the shape is unchanged, but the segment can now be bent.
        const third = c.point2.subtract(c.point1).divide(3);
        c.handle1 = third;
        c.handle2 = third.multiply(-1);
        changed = true;
      }
    }
    if (changed) this.host.commit();
  }

  // ---------------------------------------------------------------- structure (add / delete / break / join)
  private isEnd(seg: paper.Segment): boolean {
    return !seg.path.closed && (seg.isFirst() || seg.isLast());
  }

  /** Re-selects nodes after an edit that renumbered them. */
  private selectSegments(segs: paper.Segment[]) {
    const paths = this.paths();
    this.nodes.clear();
    this.segs.clear();
    for (const seg of segs) {
      const s = seg.path ? paths.indexOf(seg.path) : -1;
      if (s >= 0) this.nodes.add(key(s, seg.index));
    }
  }

  /** A single curve becomes a compound path so it can hold several pieces (after a break). */
  private ensureCompound() {
    if (!this.target || this.isCompound(this.target)) return;
    const t = this.target as paper.Path;
    const ps = this.host.ps;
    const cp = new ps.CompoundPath({ insert: false });
    cp.copyAttributes(t, false);
    const own = { ...t.data };
    cp.data = own.id ? { id: own.id } : {};
    delete own.id;
    cp.insertAbove(t);
    t.data = own;
    cp.addChild(t);
    this.target = cp;
  }

  /** Tidies up after a structural edit: drops empty pieces, unwraps a compound left with one piece. */
  private normalizeTarget() {
    let t: EditTarget | null = this.target;
    if (!t) return;
    if (!this.isCompound(t)) {
      if ((t as paper.Path).segments.length < 2) {
        t.remove();
        t = null;
      }
    } else {
      for (const c of [...t.children] as paper.Path[]) if (c.segments.length < 2) c.remove();
      if (t.children.length === 1) {
        const child = t.children[0] as paper.Path;
        const own = { ...child.data };
        child.copyAttributes(t, false);
        child.data = t.data.id ? { ...own, id: t.data.id } : own;
        child.insertAbove(t);
        t.remove();
        t = child;
      } else if (t.children.length === 0) {
        t.remove();
        t = null;
      }
    }
    this.target = t;
    if (!t) {
      this.address = null;
      this.nodes.clear();
      this.segs.clear();
      this.host.selectTop(null);
      return;
    }
    this.address = this.addressOf(t);
    this.host.selectTop(this.host.topLevel(t));
  }

  /**
   * Runs an edit that adds, removes or re-orders nodes, keeping every
   * surviving node's type (cusp / smooth / symmetrical) attached to it.
   */
  private structural(fn: () => paper.Segment[] | void) {
    if (!this.target) return;
    const types = new Map<paper.Segment, NodeType>();
    for (const path of this.paths()) {
      const t = this.typesOf(path);
      path.segments.forEach((seg, i) => types.set(seg, t[i]));
    }
    const select = fn();
    this.normalizeTarget();
    for (const path of this.paths()) path.data.nt = path.segments.map((seg) => types.get(seg) ?? inferNodeType(seg.handleIn, seg.handleOut)).join("");
    if (select) this.selectSegments(select);
    else this.pruneNodes();
    this.host.commit();
  }

  /** Adds a node exactly where the outline was double-clicked; the curve's shape does not change. */
  private addNodeAt(hit: CurveHit) {
    this.structural(() => {
      const second = hit.curve.divideAtTime(hit.time);
      return second ? [second.segment1] : [];
    });
  }

  /** "+": adds a node at the middle (by length) of each selected segment. */
  addNodes() {
    const curves = this.actionCurves();
    if (!curves.length) return;
    this.structural(() => {
      const added: paper.Segment[] = [];
      // Back to front, so earlier curve indices stay valid.
      for (const c of [...curves].sort((a, b) => b.index - a.index)) {
        const second = c.divideAt(c.length / 2);
        if (second) added.push(second.segment1);
      }
      return added;
    });
  }

  /** Removes one node, re-fitting the neighbouring handles so the outline keeps its shape as closely as one curve can. */
  private removeNode(seg: paper.Segment) {
    const prev = seg.previous;
    const next = seg.next;
    const ps = this.host.ps;
    if (!prev || !next || prev === next) return void seg.remove();
    const c1 = prev.curve;
    const c2 = seg.curve;
    if (!c1.hasHandles() && !c2.hasHandles()) return void seg.remove();
    const l1 = c1.length;
    const total = l1 + c2.length;
    const samples: { p: paper.Point; t: number }[] = [];
    const N = 8;
    for (let k = 1; k <= N; k++) samples.push({ p: c1.getPointAt((l1 * k) / N), t: (l1 * k) / N / total });
    for (let k = 1; k < N; k++) samples.push({ p: c2.getPointAt((c2.length * k) / N), t: (l1 + (c2.length * k) / N) / total });
    const dirA = (prev.handleOut.isZero() ? seg.point.subtract(prev.point) : prev.handleOut).normalize();
    const dirC = (next.handleIn.isZero() ? seg.point.subtract(next.point) : next.handleIn).normalize();
    const { alpha, beta } = fitHandleLengths(prev.point, dirA, next.point, dirC, samples);
    seg.remove();
    prev.handleOut = new ps.Point(dirA.multiply(alpha));
    next.handleIn = new ps.Point(dirC.multiply(beta));
  }

  /** Delete / "-": removes the selected nodes. */
  deleteNodes() {
    const segs = this.selectedSegments();
    if (!segs.length) return;
    this.structural(() => {
      for (const seg of [...segs].sort((a, b) => b.index - a.index)) if (seg.path) this.removeNode(seg);
      return [];
    });
  }

  /** Break apart: splits the outline at each selected node, leaving two loose ends there. */
  breakAtNodes() {
    const segs = this.selectedSegments().filter((s) => !this.isEnd(s));
    if (!segs.length) return;
    this.structural(() => {
      this.ensureCompound();
      const ends: paper.Segment[] = [];
      for (const seg of [...segs].sort((a, b) => b.index - a.index)) {
        const path = seg.path;
        if (!path || this.isEnd(seg)) continue;
        const wasClosed = path.closed;
        const other = path.splitAt(seg.location);
        if (wasClosed) ends.push(path.firstSegment, path.lastSegment);
        else if (other) ends.push(path.lastSegment, other.firstSegment);
      }
      return ends;
    });
  }

  /** The two selected loose ends, if exactly two are selected. */
  private selectedEnds(): [paper.Segment, paper.Segment] | null {
    const ends = this.selectedSegments().filter((s) => this.isEnd(s));
    return ends.length === 2 && this.selectedSegments().length === 2 ? [ends[0], ends[1]] : null;
  }

  /**
   * Join: merges two loose ends into one node (at their midpoint if they
   * are apart). `withLine` connects them with a straight line instead
   * ("Extend curve to close"). Works within one path or across two.
   */
  joinEnds(withLine: boolean) {
    const pair = this.selectedEnds();
    if (!pair) {
      if (withLine) this.closeWithLine();
      return;
    }
    const ps = this.host.ps;
    const zero = () => new ps.Point(0, 0);
    this.structural(() => {
      let [a, b] = pair;
      const A = a.path;
      const B = b.path;
      if (A === B) {
        const first = A.firstSegment;
        const last = A.lastSegment;
        if (withLine) {
          first.handleIn = zero();
          last.handleOut = zero();
          A.closed = true;
          return [first, last];
        }
        first.point = first.point.add(last.point).divide(2);
        first.handleIn = last.handleIn;
        last.remove();
        A.closed = true;
        return [first];
      }
      // Make A end at `a` and B start at `b`, then append B to A.
      if (a.isFirst()) A.reverse();
      if (b.isLast()) B.reverse();
      a = A.lastSegment;
      b = B.firstSegment;
      const moved = B.removeSegments();
      B.remove();
      if (withLine) {
        a.handleOut = zero();
        moved[0].handleIn = zero();
        A.addSegments(moved);
        return [a, moved[0]];
      }
      a.point = a.point.add(moved[0].point).divide(2);
      a.handleOut = moved[0].handleOut;
      A.addSegments(moved.slice(1));
      return [a];
    });
  }

  /** Paths the path-level commands act on: those with a selected node or segment, else every subpath. */
  private actionPaths(): paper.Path[] {
    const chosen = new Set<paper.Path>();
    for (const s of this.selectedSegments()) chosen.add(s.path);
    for (const c of this.selectedCurves()) chosen.add(c.path);
    return chosen.size ? [...chosen] : this.paths();
  }

  /** Extend curve to close: joins each open path's start and end with a straight line. */
  private closeWithLine() {
    const open = this.actionPaths().filter((p) => !p.closed);
    if (!open.length) return;
    const ps = this.host.ps;
    this.structural(() => {
      for (const path of open) {
        path.firstSegment.handleIn = new ps.Point(0, 0);
        path.lastSegment.handleOut = new ps.Point(0, 0);
        path.closed = true;
      }
    });
  }

  /** Close / open toggle. Opening removes the segment that runs from the last node back to the first. */
  toggleClosed() {
    const paths = this.actionPaths();
    if (!paths.length) return;
    this.structural(() => {
      for (const path of paths) path.closed = !path.closed;
    });
  }

  reverseDirection() {
    const paths = this.actionPaths();
    if (!paths.length) return;
    const keep = this.selectedSegments();
    this.structural(() => {
      for (const path of paths) path.reverse();
      return keep;
    });
  }

  /** Lines the selected nodes up with the last one selected: "h" = on one horizontal line (same Y), "v" = same X. */
  alignNodes(axis: "h" | "v") {
    const segs = this.selectedSegments();
    if (segs.length < 2) return;
    const ref = this.pagePoint(segs[segs.length - 1]);
    const ps = this.host.ps;
    for (const seg of segs) {
      const p = this.pagePoint(seg);
      this.setPagePoint(seg, axis === "h" ? new ps.Point(p.x, ref.y) : new ps.Point(ref.x, p.y));
    }
    this.host.commit();
  }

  /** Double-click: on a node = delete it, on the outline = add a node exactly there. */
  doubleClick(vp: paper.Point, p: paper.Point) {
    if (!this.target || this.preview) return;
    const node = this.hitNode(vp);
    if (node) {
      this.nodes = new Set([node.key]);
      this.segs.clear();
      this.deleteNodes();
      return;
    }
    const hit = this.hitCurve(p);
    if (hit) this.addNodeAt(hit);
  }

  // ---------------------------------------------------------------- simplify (reduce nodes)
  private isCorner(seg: paper.Segment): boolean {
    const prev = seg.previous;
    const next = seg.next;
    if (!prev || !next) return true;
    const incoming = seg.handleIn.isZero() ? seg.point.subtract(prev.point) : seg.handleIn.multiply(-1);
    const outgoing = seg.handleOut.isZero() ? next.point.subtract(seg.point) : seg.handleOut;
    return turnAngle(incoming, outgoing) > CORNER_DEG;
  }

  /** Paper's curve fitter, run between corners so sharp corners stay sharp. */
  private simplifiedCopy(path: paper.Path, tolerance: number): paper.Path {
    const ps = this.host.ps;
    const segs = path.segments;
    const n = segs.length;
    const out = new ps.Path({ insert: false, closed: path.closed });
    // Paper's fitter compares SQUARED distances, so square our tolerance to make it a real distance in inches.
    const fitError = tolerance * tolerance;
    const corners: number[] = [];
    for (let i = 0; i < n; i++) if (this.isCorner(segs[i])) corners.push(i);
    if (n < 3) {
      out.addSegments(segs.map((s) => s.clone()));
      return out;
    }
    if (!corners.length) {
      // A closed outline with no corners: fit it in one go.
      out.addSegments(segs.map((s) => s.clone()));
      out.simplify(fitError);
      return out;
    }
    const runs: number[][] = [];
    const last = path.closed ? corners.length : corners.length - 1;
    for (let c = 0; c < last; c++) {
      const from = corners[c];
      const to = corners[(c + 1) % corners.length];
      const run: number[] = [from];
      for (let i = (from + 1) % n; ; i = (i + 1) % n) {
        run.push(i);
        if (i === to) break;
      }
      runs.push(run);
    }
    const result: paper.Segment[] = [];
    runs.forEach((run, r) => {
      const piece = new ps.Path({ insert: false, segments: run.map((i) => segs[i].clone()) });
      piece.firstSegment.handleIn = new ps.Point(0, 0);
      piece.lastSegment.handleOut = new ps.Point(0, 0);
      if (run.length > 2) piece.simplify(fitError);
      const fitted = piece.segments.map((s) => s.clone());
      if (result.length) {
        // The corner is shared: keep one node, with this run's outgoing handle.
        result[result.length - 1].handleOut = fitted[0].handleOut;
        fitted.shift();
      }
      if (path.closed && r === runs.length - 1) {
        // The last run ends back on the first corner.
        result[0].handleIn = fitted[fitted.length - 1].handleIn;
        fitted.pop();
      }
      result.push(...fitted);
    });
    out.addSegments(result);
    // A fitted curve that is really a straight line goes back to being a line.
    for (const c of out.curves) if (c.hasHandles() && c.isStraight()) c.clearHandles();
    return out;
  }

  /** Shows what Simplify would do at this tolerance (inches). Nothing changes until applySimplify(). */
  previewSimplify(tolerance: number) {
    if (!this.target) return;
    const paths = this.paths();
    this.nodes.clear();
    this.segs.clear();
    this.preview = {
      tolerance,
      before: paths.reduce((n, p) => n + p.segments.length, 0),
      paths: paths.map((p) => this.simplifiedCopy(p, tolerance)),
    };
    this.host.selectionChanged();
    this.host.changed();
  }

  applySimplify() {
    const pv = this.preview;
    if (!pv || !this.target) return;
    this.preview = null;
    this.paths().forEach((path, i) => {
      const fitted = pv.paths[i];
      if (!fitted) return;
      path.removeSegments();
      path.addSegments(fitted.segments.map((s) => s.clone()));
      delete path.data.nt;
    });
    this.host.commit();
  }

  cancelSimplify() {
    if (!this.preview) return;
    this.preview = null;
    this.host.changed();
  }

  // ---------------------------------------------------------------- check outlines
  /** Every open path in the document (Phase 3 needs closed outlines to place prints in). */
  openPaths(): OpenPathInfo[] {
    const ps = this.host.ps;
    const out: OpenPathInfo[] = [];
    for (const path of this.host.contentLayer().getItems({ class: ps.Path }) as paper.Path[]) {
      if (path.closed || path.segments.length < 2 || path.clipMask) continue;
      const top = this.host.topLevel(path);
      const address = this.addressOf(path);
      if (!top || !top.visible || !address) continue;
      out.push({
        address,
        label: top.name || (top instanceof ps.Group ? "Group" : "Curve"),
        nodes: path.segments.length,
        gap: this.pagePoint(path.firstSegment).getDistance(this.pagePoint(path.lastSegment)),
      });
    }
    return out.sort((a, b) => b.nodes - a.nodes);
  }

  /** Opens an item found by openPaths() for editing, with its two loose ends selected. Returns its bounds. */
  enterOpenPath(address: ItemAddress): paper.Rectangle | null {
    const item = this.resolve(address);
    if (!(item instanceof this.host.ps.Path)) return null;
    this.enter(item);
    if (!this.target) return null;
    this.selectSegments([item.firstSegment, item.lastSegment]);
    this.host.selectionChanged();
    return item.bounds;
  }

  /** The text / rectangle / ellipse the convert-to-curves hint is showing for, if any. */
  get convertible(): Item | null {
    return this.hintItem && this.hintItem.isInserted() ? this.hintItem : null;
  }

  get hasTarget() {
    return !!this.target;
  }

  // ---------------------------------------------------------------- state
  state(): NodeEditState {
    const paths = this.paths();
    const segs = this.selectedSegments();
    let point: NodeEditState["point"] = null;
    let bounds: Rect | null = null;
    if (segs.length === 1) {
      const p = this.pagePoint(segs[0]);
      point = { x: p.x, y: p.y };
    } else if (segs.length > 1) {
      let l = Infinity;
      let t = Infinity;
      let r = -Infinity;
      let b = -Infinity;
      for (const s of segs) {
        const p = this.pagePoint(s);
        l = Math.min(l, p.x);
        r = Math.max(r, p.x);
        t = Math.min(t, p.y);
        b = Math.max(b, p.y);
      }
      bounds = { x: l, y: t, w: r - l, h: b - t };
    }
    let nodeType: NodeEditState["nodeType"] = null;
    for (const s of segs) {
      const t = this.typeOf(s);
      nodeType = nodeType === null ? t : nodeType === t ? t : "mixed";
      if (nodeType === "mixed") break;
    }
    const curves = this.actionCurves();
    return {
      hasTarget: !!this.target,
      hint: this.hint,
      total: paths.reduce((n, p) => n + p.segments.length, 0),
      selected: segs.length,
      subpaths: paths.length,
      open: paths.some((p) => !p.closed),
      point,
      bounds,
      nodeType,
      segments: curves.length,
      hasCurve: curves.some((c) => c.hasHandles()),
      hasLine: curves.some((c) => !c.hasHandles()),
      segmentLength: curves.length ? curves.reduce((n, c) => n + this.curveLength(c), 0) : null,
      openEnds: segs.filter((s) => this.isEnd(s)).length,
      canJoin: !!this.selectedEnds(),
      canBreak: segs.some((s) => !this.isEnd(s)),
      simplify: this.preview ? { tolerance: this.preview.tolerance, before: this.preview.before, after: this.preview.paths.reduce((n, p) => n + p.segments.length, 0) } : null,
    };
  }

  /** Curve length in page inches (allows for a transform on the path). */
  private curveLength(c: paper.Curve): number {
    const m = c.path.globalMatrix;
    if (m.isIdentity()) return c.length;
    const ps = this.host.ps;
    return new ps.Curve(m.transform(c.point1), m.transform(c.point1.add(c.handle1)).subtract(m.transform(c.point1)), m.transform(c.point2.add(c.handle2)).subtract(m.transform(c.point2)), m.transform(c.point2)).length;
  }

  // ---------------------------------------------------------------- drawing
  /** Draws node markers for the edited object only, and only those inside the viewport. `ctx` is in CSS pixels. */
  draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
    if (!this.target) return;
    const view = this.host.ps.view;
    const zoom = view.zoom;
    const tl = view.bounds.topLeft;
    const pad = START_NODE_PX;
    const selected: [number, number, number][] = [];
    const sx = (pt: paper.Point) => (pt.x - tl.x) * zoom;
    const sy = (pt: paper.Point) => (pt.y - tl.y) * zoom;
    const page = (path: paper.Path, pt: paper.Point) => (path.globalMatrix.isIdentity() ? pt : path.globalMatrix.transform(pt));

    if (this.preview) {
      // Simplify preview: the would-be outline and its nodes, over the untouched original.
      const m = this.paths()[0]?.globalMatrix;
      const at = (pt: paper.Point) => (m && !m.isIdentity() ? m.transform(pt) : pt);
      ctx.strokeStyle = PREVIEW_COLOR;
      ctx.fillStyle = PREVIEW_COLOR;
      ctx.lineWidth = 1.5;
      for (const path of this.preview.paths) {
        ctx.beginPath();
        for (const c of path.curves) {
          const a = at(c.point1);
          const b = at(c.point2);
          const h1 = at(c.point1.add(c.handle1));
          const h2 = at(c.point2.add(c.handle2));
          if (c.index === 0) ctx.moveTo(sx(a), sy(a));
          ctx.bezierCurveTo(sx(h1), sy(h1), sx(h2), sy(h2), sx(b), sy(b));
        }
        ctx.stroke();
        for (const seg of path.segments) {
          const pt = at(seg.point);
          ctx.fillRect(Math.round(sx(pt)) - 2, Math.round(sy(pt)) - 2, 5, 5);
        }
      }
      return;
    }

    // Selected segments: highlighted along the curve.
    ctx.strokeStyle = NODE_COLOR;
    ctx.lineWidth = 2;
    for (const c of this.selectedCurves()) {
      const a = page(c.path, c.point1);
      const b = page(c.path, c.point2);
      const h1 = page(c.path, c.point1.add(c.handle1));
      const h2 = page(c.path, c.point2.add(c.handle2));
      ctx.beginPath();
      ctx.moveTo(sx(a), sy(a));
      ctx.bezierCurveTo(sx(h1), sy(h1), sx(h2), sy(h2), sx(b), sy(b));
      ctx.stroke();
    }

    // Control handles: thin dashed line from the node, small dot at the tip.
    const handles = this.shownHandles();
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    for (const h of handles) {
      const n = this.pagePoint(h.seg);
      const t = this.handlePoint(h.seg, h.side);
      ctx.moveTo(sx(n), sy(n));
      ctx.lineTo(sx(t), sy(t));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = NODE_COLOR;
    for (const h of handles) {
      const t = this.handlePoint(h.seg, h.side);
      ctx.beginPath();
      ctx.arc(sx(t), sy(t), HANDLE_PX / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.lineWidth = 1;
    ctx.strokeStyle = NODE_COLOR;
    ctx.fillStyle = "#ffffff";
    this.paths().forEach((path, s) => {
      const m = path.globalMatrix;
      const identity = m.isIdentity();
      const segs = path.segments;
      for (let i = 0; i < segs.length; i++) {
        const pt = identity ? segs[i].point : m.transform(segs[i].point);
        const x = (pt.x - tl.x) * zoom;
        const y = (pt.y - tl.y) * zoom;
        if (x < -pad || y < -pad || x > width + pad || y > height + pad) continue;
        const size = i === 0 ? START_NODE_PX : NODE_PX;
        if (this.nodes.has(key(s, i))) {
          selected.push([x, y, size]);
          continue;
        }
        const left = Math.round(x - size / 2) + 0.5;
        const top = Math.round(y - size / 2) + 0.5;
        ctx.fillRect(left, top, size - 1, size - 1);
        ctx.strokeRect(left, top, size - 1, size - 1);
      }
    });
    // Selected nodes last, so they are never hidden under neighbours.
    ctx.fillStyle = NODE_COLOR;
    for (const [x, y, size] of selected) ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
  }
}
