import type paper from "paper/dist/paper-core";
import { constrainOpposite, curveDragOffsets, inferNodeType, parseNodeTypes, smoothedHandles, type NodeType } from "./node-geometry";
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
  private nodes = new Set<string>();
  /** Selected segments: "subpath:index" of the node each one starts at. */
  private segs = new Set<string>();
  private drag: ShapeDrag | null = null;
  private marqueeEnd: paper.Point | null = null;

  constructor(private host: ShapeHost) {}

  // ---------------------------------------------------------------- target
  private isCompound(item: Item): item is paper.CompoundPath {
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
    this.nodes.clear();
    this.segs.clear();
    this.drag = null;
    this.target = null;
    this.address = null;
    this.hint = null;
    if (item) {
      if (item.parent && this.isCompound(item.parent)) item = item.parent;
      const lastAddress = this.lastAddress;
      if (lastAddress && item instanceof this.host.ps.Group && lastAddress.id === item.data.id) {
        const last = this.resolve(lastAddress);
        if (last && !this.hintFor(last)) item = last;
      }
      this.hint = this.hintFor(item);
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
    this.nodes.clear();
    this.segs.clear();
    this.drag = null;
    this.target = null;
    this.address = null;
    this.hint = null;
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
