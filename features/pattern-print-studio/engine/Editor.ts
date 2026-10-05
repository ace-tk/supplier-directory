import paper from "paper/dist/paper-core";
import { AssetStore, newId } from "./assets";
import { rebuildGrid } from "./grid";
import { installHairlineMinimum } from "./hairline";
import { History } from "./history";
import { collectAssetIds, fromNode, toNode, type SceneNode } from "./serialize";
import type { NodeType } from "./node-geometry";
import { ShapeTool, type NodeEditState, type ShapeMeta } from "./shape-tool";
import { buildTargets, snapPoints, SNAP_PX, type SnapTargets } from "./snap";
import { DEFAULT_PAGE, DEFAULT_SETTINGS, type DocSettings, type Guide, type Orientation, type Origin, type PageSize, type RasterAsset, type ToolId } from "./types";
import { clamp, CSS_PX_PER_INCH, MAX_ZOOM_PCT, MIN_ZOOM_PCT } from "./units";
import type { ParsedVectorImport } from "./import-svg";

type Item = paper.Item;
type Rect = { x: number; y: number; w: number; h: number };

export const DOC_FORMAT = "supplybase.pattern-print-studio";
export const DOC_VERSION = 1;

export interface DocFile {
  format: typeof DOC_FORMAT;
  version: number;
  name: string;
  page: PageSize;
  settings: DocSettings;
  origin: Origin;
  /** True while the origin follows the page's bottom-left. */
  originAtPageCorner: boolean;
  guides: Guide[];
  objects: SceneNode[];
  assets: RasterAsset[];
}

/** 0..8 reference point: 0 1 2 / 3 4 5 / 6 7 8 (top-left … bottom-right). Corel default = center. */
export type RefPoint = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface ObjectEntry {
  id: string;
  name: string;
  kind: string;
  visible: boolean;
  locked: boolean;
  selected: boolean;
}

export interface EditorState {
  docName: string;
  page: PageSize;
  settings: DocSettings;
  origin: Origin;
  guides: Guide[];
  tool: ToolId;
  zoomPct: number;
  calibration: number;
  selectionBounds: Rect | null;
  selectionCount: number;
  selectedText: { fontSize: number; content: string } | null;
  selectedGuideId: string | null;
  objects: ObjectEntry[];
  canUndo: boolean;
  canRedo: boolean;
  unsaved: boolean;
  refPoint: RefPoint;
  lockAspect: boolean;
  cursor: { x: number; y: number } | null;
  snapLabel: string | null;
  rotateMode: boolean;
  /** Shape tool (node editing) state; null in every other tool. */
  nodeEdit: NodeEditState | null;
}

export interface ViewInfo {
  /** Screen px per inch at the current zoom (CSS px). */
  ppi: number;
  /** Project-space (inches) coordinate at the canvas top-left. */
  left: number;
  top: number;
  width: number;
  height: number;
}

type DragState =
  | { kind: "pan"; startClient: paper.Point; startCenter: paper.Point }
  | { kind: "move"; start: paper.Point; startBounds: paper.Rectangle; applied: paper.Point; moved: boolean; targets: SnapTargets; wasSelected: boolean }
  | { kind: "scale"; handle: number; anchor: paper.Point; startBounds: paper.Rectangle; sx: number; sy: number; targets: SnapTargets; fromCenter: boolean }
  | { kind: "rotate"; center: paper.Point; startAngle: number; applied: number }
  | { kind: "marquee"; start: paper.Point; additive: boolean; touching: boolean }
  | { kind: "create"; shape: "rectangle" | "ellipse"; start: paper.Point; targets: SnapTargets }
  | { kind: "zoomRect"; start: paper.Point; startClient: paper.Point }
  | { kind: "guide"; guideId: string; orientation: Orientation; created: boolean; targets: SnapTargets }
  | { kind: "origin"; targets: SnapTargets }
  | { kind: "shape" };

const HANDLE_PX = 7;
const HIT_PX = 5;
const SELECT_COLOR = "#2563eb";
const GUIDE_COLOR = "#2563eb";
const GUIDE_SELECTED_COLOR = "#dc2626";
const NEW_SHAPE_STROKE = 0.01; // inches
const CALIBRATION_KEY = "pps.screenCalibration";

function rectOf(b: paper.Rectangle): Rect {
  return { x: b.x, y: b.y, w: b.width, h: b.height };
}

/**
 * The Pattern Print Studio editor. Owns one Paper.js scope. Project units
 * are INCHES (y down); the screen scale is 96 CSS px × calibration × zoom.
 * React reads state through subscribe/getState; rulers read getViewInfo().
 */
export class Editor {
  readonly ps: paper.PaperScope;
  readonly assets = new AssetStore();
  private canvas: HTMLCanvasElement;
  /** 2D canvas above the Paper canvas for node markers (cheap to redraw, never part of the document). */
  private nodeCanvas: HTMLCanvasElement;
  private shape!: ShapeTool;
  private pageLayer!: paper.Layer;
  private pageRect: paper.Path | null = null;
  private gridLayer!: paper.Layer;
  contentLayer!: paper.Layer;
  private guideLayer!: paper.Layer;
  private overlayLayer!: paper.Layer;

  private page: PageSize = { ...DEFAULT_PAGE };
  private settings: DocSettings = structuredClone(DEFAULT_SETTINGS);
  private origin: Origin = { x: 0, y: DEFAULT_PAGE.height };
  private originAtPageCorner = true;
  private guides: Guide[] = [];
  private docName = "Untitled";
  private tool: ToolId = "pick";
  private zoomPct = 100;
  private calibration = 1;
  private selected: Item[] = [];
  private selectedGuideId: string | null = null;
  private refPoint: RefPoint = 4;
  private lockAspect = true;
  private rotateMode = false;
  private cursor: { x: number; y: number } | null = null;
  private snapLabel: string | null = null;
  private snapMarker: paper.Point | null = null;
  private marqueeRect: paper.Rectangle | null = null;
  private history = new History<ShapeMeta>(100);
  private unsaved = false;
  private draftDirty = false;
  private clipboard: SceneNode[] = [];
  private drag: DragState | null = null;
  private spaceDown = false;
  private spacePanned = false;
  private fittedOnce = false;

  private state: EditorState;
  private listeners = new Set<() => void>();
  private viewListeners = new Set<() => void>();
  private emitScheduled = false;
  private resizeObserver: ResizeObserver;
  private cleanup: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.nodeCanvas = document.createElement("canvas");
    this.nodeCanvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
    this.nodeCanvas.setAttribute("aria-hidden", "true");
    canvas.insertAdjacentElement("afterend", this.nodeCanvas);
    installHairlineMinimum();
    this.ps = new paper.PaperScope();
    this.ps.setup(canvas);
    this.ps.settings.hitTolerance = 0;
    try {
      const saved = Number(localStorage.getItem(CALIBRATION_KEY));
      if (saved > 0.2 && saved < 5) this.calibration = saved;
    } catch {
      /* storage unavailable */
    }

    const ps = this.ps;
    ps.activate();
    this.pageLayer = new ps.Layer({ name: "page" });
    this.gridLayer = new ps.Layer({ name: "grid" });
    this.contentLayer = new ps.Layer({ name: "content" });
    this.guideLayer = new ps.Layer({ name: "guides" });
    this.overlayLayer = new ps.Layer({ name: "overlay" });
    this.contentLayer.activate();

    this.shape = new ShapeTool({
      ps,
      contentLayer: () => this.contentLayer,
      px: () => this.px,
      topLevel: (item) => this.topLevel(item),
      idOf: (item) => this.idOf(item),
      snapTargets: (skip, excludeBounds) => this.snapTargets(true, { skip, excludeBounds }),
      setSnap: (label, at) => {
        this.snapLabel = label;
        this.snapMarker = at ? new ps.Point(at.x, at.y) : null;
      },
      setMarquee: (r) => {
        this.marqueeRect = r;
      },
      selectTop: (item) => {
        this.selected = item ? [item] : [];
        this.selectedGuideId = null;
      },
      commit: () => this.commit(),
      changed: () => {
        this.drawOverlay();
        this.emit();
      },
      selectionChanged: () => this.history.setMeta(this.shape.meta()),
    });

    this.state = this.buildState();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.attachEvents();
    this.handleResize();
    this.drawPage();
    this.history.reset(this.snapshot());
  }

  destroy() {
    this.resizeObserver.disconnect();
    for (const c of this.cleanup) c();
    this.nodeCanvas.remove();
    this.ps.project.remove();
    this.listeners.clear();
    this.viewListeners.clear();
  }

  // ---------------------------------------------------------------- state
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getState = () => this.state;
  onView(fn: () => void) {
    this.viewListeners.add(fn);
    return () => this.viewListeners.delete(fn);
  }

  private buildState(): EditorState {
    const b = this.selectionBounds();
    const single = this.selected.length === 1 ? this.selected[0] : null;
    return {
      docName: this.docName,
      page: { ...this.page },
      settings: this.settings,
      origin: { ...this.origin },
      guides: this.guides,
      tool: this.tool,
      zoomPct: this.zoomPct,
      calibration: this.calibration,
      selectionBounds: b ? rectOf(b) : null,
      selectionCount: this.selected.length,
      selectedText: single instanceof this.ps.PointText ? { fontSize: Number(single.fontSize), content: single.content } : null,
      selectedGuideId: this.selectedGuideId,
      objects: this.contentLayer.children
        .slice()
        .reverse()
        .map((it) => ({
          id: this.idOf(it),
          name: it.name || this.kindOf(it),
          kind: this.kindOf(it),
          visible: it.visible,
          locked: it.locked,
          selected: this.selected.includes(it),
        })),
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      unsaved: this.unsaved,
      refPoint: this.refPoint,
      lockAspect: this.lockAspect,
      cursor: this.cursor,
      snapLabel: this.snapLabel,
      rotateMode: this.rotateMode,
      nodeEdit: this.tool === "shape" ? this.shape.state() : null,
    };
  }

  /** Re-render React (rAF-batched) after any state change. */
  private emit() {
    if (this.emitScheduled) return;
    this.emitScheduled = true;
    requestAnimationFrame(() => {
      this.emitScheduled = false;
      this.state = this.buildState();
      for (const l of this.listeners) l();
    });
  }

  private viewChanged() {
    this.zoomPct = (this.ps.view.zoom / (CSS_PX_PER_INCH * this.calibration)) * 100;
    this.updatePageShadow();
    rebuildGrid(this.ps, this.gridLayer, this.settings.grid, this.origin, this.ps.view.bounds, this.ps.view.zoom);
    this.drawGuides();
    this.drawOverlay();
    for (const l of this.viewListeners) l();
    this.emit();
  }

  getViewInfo(): ViewInfo {
    const v = this.ps.view;
    return { ppi: v.zoom, left: v.bounds.left, top: v.bounds.top, width: v.viewSize.width, height: v.viewSize.height };
  }

  // ---------------------------------------------------------------- helpers
  private idOf(item: Item): string {
    if (!item.data.id) item.data.id = newId();
    return item.data.id;
  }
  private kindOf(item: Item): string {
    const ps = this.ps;
    if (item instanceof ps.Group) return item.clipped ? "Clip group" : `Group of ${item.children.length}`;
    if (item instanceof ps.CompoundPath) return "Compound path";
    if (item instanceof ps.Path) return item.closed ? "Closed path" : "Path";
    if (item instanceof ps.PointText) return `Text "${item.content.slice(0, 16)}"`;
    if (item instanceof ps.Raster) return "Bitmap";
    return item.className;
  }
  /** Inches per screen pixel. */
  private get px() {
    return 1 / this.ps.view.zoom;
  }
  private selectionBounds(): paper.Rectangle | null {
    if (!this.selected.length) return null;
    return this.selected.map((i) => i.bounds).reduce((a, b) => a.unite(b));
  }
  private topLevel(item: Item | null): Item | null {
    while (item && item.parent !== this.contentLayer) item = item.parent;
    return item;
  }
  private markChanged() {
    this.unsaved = true;
    this.draftDirty = true;
  }
  /** Records an undo step after a committed action. */
  commit() {
    if (this.tool === "shape") this.shape.validate();
    if (this.history.push(this.snapshot(), this.shape.meta())) this.markChanged();
    this.drawOverlay();
    this.emit();
  }

  // ---------------------------------------------------------------- view
  private handleResize() {
    const host = this.canvas.parentElement;
    if (!host) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w <= 0 || h <= 0) return;
    this.ps.view.viewSize = new this.ps.Size(w, h);
    const dpr = window.devicePixelRatio || 1;
    this.nodeCanvas.width = Math.round(w * dpr);
    this.nodeCanvas.height = Math.round(h * dpr);
    if (!this.fittedOnce) {
      // First real layout: fit the page (the constructor may run before layout).
      this.fittedOnce = true;
      this.fitPage();
      return;
    }
    this.viewChanged();
  }

  private setPpi(ppi: number, anchorView?: paper.Point) {
    const v = this.ps.view;
    const minPpi = CSS_PX_PER_INCH * this.calibration * (MIN_ZOOM_PCT / 100);
    const maxPpi = CSS_PX_PER_INCH * this.calibration * (MAX_ZOOM_PCT / 100);
    ppi = clamp(ppi, minPpi, maxPpi);
    if (anchorView) {
      const before = v.viewToProject(anchorView);
      v.zoom = ppi;
      const after = v.viewToProject(anchorView);
      v.center = v.center.add(before.subtract(after));
    } else {
      v.zoom = ppi;
    }
    this.viewChanged();
  }

  setZoomPct(pct: number, anchorView?: paper.Point) {
    this.setPpi(CSS_PX_PER_INCH * this.calibration * (pct / 100), anchorView);
  }

  zoomBy(factor: number, anchorView?: paper.Point) {
    const size = this.ps.view.viewSize;
    this.setPpi(this.ps.view.zoom * factor, anchorView ?? new this.ps.Point(size.width / 2, size.height / 2));
  }

  private fitRect(r: paper.Rectangle, marginPx = 40) {
    const v = this.ps.view;
    if (r.width <= 0 && r.height <= 0) return;
    const sw = Math.max(1, v.viewSize.width - marginPx * 2);
    const sh = Math.max(1, v.viewSize.height - marginPx * 2);
    const ppi = Math.min(r.width > 0 ? sw / r.width : Infinity, r.height > 0 ? sh / r.height : Infinity);
    this.setPpi(ppi);
    v.center = r.center;
    this.viewChanged();
  }

  fitPage() {
    this.fitRect(new this.ps.Rectangle(0, 0, this.page.width, this.page.height));
  }
  fitSelection() {
    const b = this.selectionBounds();
    if (b) this.fitRect(b);
  }
  fitAll() {
    const items = this.contentLayer.children.filter((c) => c.visible);
    if (!items.length) return this.fitPage();
    this.fitRect(items.map((i) => i.bounds).reduce((a, b) => a.unite(b)));
  }

  panBy(dxPx: number, dyPx: number) {
    const v = this.ps.view;
    v.center = v.center.add(new this.ps.Point(dxPx, dyPx).divide(v.zoom));
    this.viewChanged();
  }

  setCalibration(factor: number) {
    const pct = this.zoomPct;
    this.calibration = clamp(factor, 0.2, 5);
    try {
      localStorage.setItem(CALIBRATION_KEY, String(this.calibration));
    } catch {
      /* ignore */
    }
    this.setZoomPct(pct);
  }

  // ---------------------------------------------------------------- page / settings
  private drawPage() {
    const ps = this.ps;
    this.pageLayer.removeChildren();
    const r = new ps.Path.Rectangle({ rectangle: new ps.Rectangle(0, 0, this.page.width, this.page.height), insert: false });
    r.fillColor = new ps.Color("#ffffff");
    r.shadowColor = new ps.Color(0, 0, 0, 0.22);
    this.pageRect = r;
    this.updatePageShadow();
    const border = r.clone({ insert: false }) as paper.Path;
    border.fillColor = null;
    border.shadowColor = null;
    border.strokeColor = new ps.Color("#9aa3b2");
    border.strokeWidth = 1;
    border.strokeScaling = false;
    this.pageLayer.addChildren([r, border]);
  }

  /** Paper scales shadows by the view matrix, so keep them a fixed screen size. */
  private updatePageShadow() {
    if (!this.pageRect) return;
    const z = this.ps.view.zoom || 1;
    this.pageRect.shadowBlur = 14 / z;
    this.pageRect.shadowOffset = new this.ps.Point(3 / z, 4 / z);
  }

  setPage(size: PageSize, record = true) {
    this.page = { width: Math.max(0.01, size.width), height: Math.max(0.01, size.height) };
    if (this.originAtPageCorner) this.origin = { x: 0, y: this.page.height };
    this.drawPage();
    this.viewChanged();
    if (record) this.commit();
  }

  updateSettings(patch: Partial<DocSettings>) {
    this.settings = { ...this.settings, ...patch };
    this.markChanged();
    this.viewChanged();
  }

  toggleGrid() {
    this.updateSettings({ grid: { ...this.settings.grid, visible: !this.settings.grid.visible } });
  }

  private toolCursor(tool = this.tool) {
    return tool === "pan" ? "grab" : tool === "zoom" ? "zoom-in" : tool === "pick" || tool === "shape" ? "default" : "crosshair";
  }

  setTool(tool: ToolId) {
    const was = this.tool;
    this.tool = tool;
    this.rotateMode = false;
    this.marqueeRect = null;
    if (tool === "shape" && was !== "shape") {
      // Start on the selected object, like switching to the Shape tool in Corel.
      this.shape.enter(this.selected.length === 1 ? this.selected[0] : null);
    } else if (tool !== "shape" && was === "shape") {
      this.shape.clear();
      this.history.setMeta(this.shape.meta());
    }
    this.canvas.style.cursor = this.toolCursor();
    this.drawOverlay();
    this.emit();
  }

  /** Space tap: Shape tool ⇄ Pick tool (any other tool returns to Pick). */
  toggleShapePick() {
    this.setTool(this.tool === "pick" ? "shape" : "pick");
  }

  setRefPoint(p: RefPoint) {
    this.refPoint = p;
    this.emit();
  }
  setLockAspect(v: boolean) {
    this.lockAspect = v;
    this.emit();
  }

  // ---------------------------------------------------------------- origin & guides
  setOrigin(o: Origin, atPageCorner = false) {
    this.origin = o;
    this.originAtPageCorner = atPageCorner;
    this.markChanged();
    this.viewChanged();
  }
  resetOrigin() {
    this.setOrigin({ x: 0, y: this.page.height }, true);
  }

  private drawGuides() {
    const ps = this.ps;
    this.guideLayer.removeChildren();
    this.guideLayer.visible = this.settings.guidesVisible;
    const vb = this.ps.view.bounds;
    for (const g of this.guides) {
      const line =
        g.orientation === "h"
          ? new ps.Path.Line({ from: [vb.left, g.pos], to: [vb.right, g.pos], insert: false })
          : new ps.Path.Line({ from: [g.pos, vb.top], to: [g.pos, vb.bottom], insert: false });
      line.strokeColor = new ps.Color(g.id === this.selectedGuideId ? GUIDE_SELECTED_COLOR : GUIDE_COLOR);
      line.strokeWidth = 1;
      line.strokeScaling = false;
      line.dashArray = [5, 4];
      line.data.guideId = g.id;
      this.guideLayer.addChild(line);
    }
  }

  addGuide(orientation: Orientation, pos: number): string {
    const g: Guide = { id: newId("g"), orientation, pos };
    this.guides = [...this.guides, g];
    this.drawGuides();
    return g.id;
  }
  private setGuidePos(id: string, pos: number) {
    this.guides = this.guides.map((g) => (g.id === id ? { ...g, pos } : g));
    this.drawGuides();
  }
  deleteGuide(id: string) {
    this.guides = this.guides.filter((g) => g.id !== id);
    if (this.selectedGuideId === id) this.selectedGuideId = null;
    this.drawGuides();
    this.commit();
  }
  clearGuides() {
    this.guides = [];
    this.selectedGuideId = null;
    this.drawGuides();
    this.commit();
  }

  private guideAt(viewPoint: paper.Point): Guide | null {
    if (!this.settings.guidesVisible) return null;
    const p = this.ps.view.viewToProject(viewPoint);
    let best: Guide | null = null;
    let bestD = HIT_PX * this.px;
    for (const g of this.guides) {
      const d = Math.abs((g.orientation === "h" ? p.y : p.x) - g.pos);
      if (d <= bestD) {
        bestD = d;
        best = g;
      }
    }
    return best;
  }

  /** Called by a ruler on pointerdown: drags out a new guideline. */
  beginGuideFromRuler(orientation: Orientation, e: PointerEvent) {
    const id = this.addGuide(orientation, orientation === "h" ? this.ps.view.bounds.top - 1 : this.ps.view.bounds.left - 1);
    this.selectedGuideId = id;
    this.drag = { kind: "guide", guideId: id, orientation, created: true, targets: this.snapTargets(true) };
    this.trackWindowPointer(e);
  }

  /** Called by the ruler corner: drags the ruler origin. */
  beginOriginDrag(e: PointerEvent) {
    this.drag = { kind: "origin", targets: this.snapTargets(true) };
    this.trackWindowPointer(e);
  }

  /** Window-level move/up tracking for drags that start on a ruler. */
  private trackWindowPointer(e: PointerEvent) {
    const move = (ev: PointerEvent) => this.onPointerMove(ev);
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      this.onPointerUp(ev);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    this.onPointerMove(e);
  }

  // ---------------------------------------------------------------- snapping
  private snapTargets(includeSelection = false, opts: { skip?: Set<paper.Segment>; excludeBounds?: Item | null } = {}): SnapTargets {
    const vb = this.ps.view.bounds.expand(this.ps.view.bounds.width * 0.5);
    const others = this.contentLayer.children.filter((c) => c.visible && (includeSelection || !this.selected.includes(c)));
    const objectBounds: { left: number; right: number; top: number; bottom: number }[] = [];
    const nodePoints: { x: number; y: number }[] = [];
    const ps = this.ps;
    for (const it of others) {
      const b = it.bounds;
      if (!b.intersects(vb)) continue;
      if (it !== opts.excludeBounds) objectBounds.push({ left: b.left, right: b.right, top: b.top, bottom: b.bottom });
      if (nodePoints.length < 50000) {
        const paths = it instanceof ps.Path ? [it] : (it.getItems({ class: ps.Path }) as paper.Path[]);
        if (it instanceof ps.CompoundPath) paths.push(...(it.children as paper.Path[]));
        for (const p of paths) for (const s of p.segments) if (!opts.skip?.has(s)) nodePoints.push({ x: s.point.x, y: s.point.y });
      }
    }
    return buildTargets({
      snap: this.settings.snap,
      guides: this.guides,
      guidesVisible: this.settings.guidesVisible,
      page: this.page,
      origin: this.origin,
      gridStep: this.settings.grid.spacing / Math.max(1, this.settings.grid.subdivisions),
      objectBounds,
      nodePoints,
      threshold: SNAP_PX * this.px,
    });
  }

  private snapPoint(p: paper.Point, targets: SnapTargets): paper.Point {
    const r = snapPoints([p], targets, SNAP_PX * this.px);
    this.snapLabel = r.label;
    this.snapMarker = r.at ? new this.ps.Point(r.at.x, r.at.y) : null;
    return p.add(new this.ps.Point(r.dx, r.dy));
  }

  // ---------------------------------------------------------------- overlay
  private handlePoints(b: paper.Rectangle): paper.Point[] {
    // 0 tl, 1 t, 2 tr, 3 r, 4 br, 5 b, 6 bl, 7 l
    return [b.topLeft, b.topCenter, b.topRight, b.rightCenter, b.bottomRight, b.bottomCenter, b.bottomLeft, b.leftCenter];
  }

  private drawOverlay() {
    const ps = this.ps;
    this.overlayLayer.removeChildren();
    const px = this.px;
    const add = (it: Item) => this.overlayLayer.addChild(it);
    const b = this.tool === "pick" ? this.selectionBounds() : null;
    if (b) {
      const pad = 4 * px;
      const box = new ps.Path.Rectangle({ rectangle: b.expand(pad * 2), insert: false });
      box.strokeColor = new ps.Color(SELECT_COLOR);
      box.strokeWidth = 1;
      box.strokeScaling = false;
      box.dashArray = this.rotateMode ? [] : [4, 3];
      add(box);
      const handles = this.handlePoints(b.expand(pad * 2));
      handles.forEach((pt, i) => {
        if (this.rotateMode) {
          if (i % 2 === 0) {
            const c = new ps.Path.Circle({ center: pt, radius: (HANDLE_PX / 2 + 1) * px, insert: false });
            c.fillColor = new ps.Color("#ffffff");
            c.strokeColor = new ps.Color(SELECT_COLOR);
            c.strokeWidth = 1.5;
            c.strokeScaling = false;
            add(c);
          }
        } else {
          const s = new ps.Path.Rectangle({ point: pt.subtract((HANDLE_PX / 2) * px), size: [HANDLE_PX * px, HANDLE_PX * px], insert: false });
          s.fillColor = new ps.Color("#111827");
          s.strokeColor = new ps.Color("#ffffff");
          s.strokeWidth = 1;
          s.strokeScaling = false;
          add(s);
        }
      });
      // center mark
      const c = b.center;
      const x = new ps.CompoundPath({
        children: [new ps.Path.Line({ from: c.add([-4 * px, 0]), to: c.add([4 * px, 0]), insert: false }), new ps.Path.Line({ from: c.add([0, -4 * px]), to: c.add([0, 4 * px]), insert: false })],
        insert: false,
      });
      x.strokeColor = new ps.Color(SELECT_COLOR);
      x.strokeWidth = 1;
      x.strokeScaling = false;
      add(x);
    }
    if (this.marqueeRect) {
      const m = new ps.Path.Rectangle({ rectangle: this.marqueeRect, insert: false });
      m.strokeColor = new ps.Color(SELECT_COLOR);
      m.fillColor = new ps.Color(37 / 255, 99 / 255, 235 / 255, 0.06);
      m.strokeWidth = 1;
      m.strokeScaling = false;
      m.dashArray = [4, 3];
      add(m);
    }
    if (this.snapMarker && this.drag) {
      const s = this.snapMarker;
      const mk = new ps.Path.Rectangle({ point: s.subtract(4 * px), size: [8 * px, 8 * px], insert: false });
      mk.strokeColor = new ps.Color("#d946ef");
      mk.strokeWidth = 1.5;
      mk.strokeScaling = false;
      add(mk);
    }
    this.drawNodeMarkers();
  }

  private drawNodeMarkers() {
    const ctx = this.nodeCanvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.nodeCanvas.width, this.nodeCanvas.height);
    if (this.tool !== "shape") return;
    this.shape.validate();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.shape.draw(ctx, this.nodeCanvas.width / dpr, this.nodeCanvas.height / dpr);
  }

  // ---------------------------------------------------------------- shape tool (node editing)
  selectAllNodes() {
    this.shape.selectAll();
  }
  /** Esc in the Shape tool. Returns false when no nodes were selected (caller then leaves the tool). */
  clearNodeSelection(): boolean {
    return this.shape.escape();
  }
  /** Makes the selected nodes cusp (c), smooth (s) or symmetrical (y). */
  setNodeType(type: NodeType) {
    this.shape.setNodeType(type);
  }
  /** Converts the selected segments to straight lines or to curves. */
  convertSegments(to: "line" | "curve") {
    this.shape.convertSegments(to);
  }
  /** Nudge the selected nodes in display direction (dy positive = UP). */
  nudgeNodes(dxUnits: number, dyUp: number) {
    this.shape.translateNodes(dxUnits, -dyUp);
  }
  /** Exact position of the single selected node, in ruler coordinates (inches, y UP from the origin). */
  setNodePosition(patch: { x?: number; y?: number }) {
    this.shape.setNodePoint({
      x: patch.x !== undefined ? this.origin.x + patch.x : undefined,
      y: patch.y !== undefined ? this.origin.y - patch.y : undefined,
    });
  }

  private hitHandle(viewPoint: paper.Point): { handle: number; rotate: boolean } | null {
    const b = this.selectionBounds();
    if (!b || this.tool !== "pick") return null;
    const pts = this.handlePoints(b.expand(8 * this.px));
    for (let i = 0; i < pts.length; i++) {
      if (this.rotateMode && i % 2 === 1) continue;
      const vp = this.ps.view.projectToView(pts[i]);
      if (vp.getDistance(viewPoint) <= HANDLE_PX) return { handle: i, rotate: this.rotateMode };
    }
    return null;
  }

  // ---------------------------------------------------------------- selection
  select(items: Item[], additive = false) {
    const next = additive ? [...this.selected] : [];
    for (const it of items) {
      if (it.locked || !it.visible) continue;
      const i = next.indexOf(it);
      if (additive && i >= 0) next.splice(i, 1);
      else if (i < 0) next.push(it);
    }
    this.selected = next;
    this.selectedGuideId = null;
    this.rotateMode = false;
    this.drawGuides();
    this.drawOverlay();
    this.emit();
  }
  selectById(id: string, additive = false) {
    const it = this.contentLayer.children.find((c) => c.data.id === id);
    if (it) this.select([it], additive);
  }
  selectAll() {
    this.select(this.contentLayer.children.filter((c) => c.visible && !c.locked));
  }
  clearSelection() {
    this.select([]);
  }

  private hitTestContent(viewPoint: paper.Point): Item | null {
    const p = this.ps.view.viewToProject(viewPoint);
    const res = this.contentLayer.hitTest(p, {
      fill: true,
      stroke: true,
      segments: false,
      tolerance: HIT_PX * this.px,
      match: (h: paper.HitResult) => {
        const top = this.topLevel(h.item);
        return !!top && top.visible && !top.locked;
      },
    });
    return res ? this.topLevel(res.item) : null;
  }

  // ---------------------------------------------------------------- transforms
  translateSelection(dx: number, dy: number, record = true) {
    if (!this.selected.length) return;
    const d = new this.ps.Point(dx, dy);
    for (const it of this.selected) it.translate(d);
    if (record) this.commit();
    else this.drawOverlay();
  }

  /** Nudge in display direction (dy positive = UP, like the rulers). */
  nudge(dxUnits: number, dyUp: number) {
    this.translateSelection(dxUnits, -dyUp);
  }

  private refPointOf(b: paper.Rectangle, ref: RefPoint) {
    const col = ref % 3;
    const row = Math.floor(ref / 3);
    return new this.ps.Point(b.left + (b.width * col) / 2, b.top + (b.height * row) / 2);
  }

  /**
   * Sets exact selection geometry from the property bar. x/y are the
   * reference point in ruler coordinates (inches, y UP from origin); w/h in
   * inches.
   */
  setSelectionGeometry(patch: { x?: number; y?: number; w?: number; h?: number }) {
    const b = this.selectionBounds();
    if (!b) return;
    const ps = this.ps;
    const anchor = this.refPointOf(b, this.refPoint);
    if (patch.w !== undefined || patch.h !== undefined) {
      let sx = patch.w !== undefined && b.width > 0 ? patch.w / b.width : 1;
      let sy = patch.h !== undefined && b.height > 0 ? patch.h / b.height : 1;
      if (this.lockAspect) {
        if (patch.w !== undefined) sy = sx;
        else sx = sy;
      }
      if (Number.isFinite(sx) && Number.isFinite(sy) && sx !== 0 && sy !== 0) for (const it of this.selected) it.scale(sx, sy, anchor);
    }
    if (patch.x !== undefined || patch.y !== undefined) {
      const nb = this.selectionBounds()!;
      const cur = this.refPointOf(nb, this.refPoint);
      const tx = patch.x !== undefined ? this.origin.x + patch.x : cur.x;
      const ty = patch.y !== undefined ? this.origin.y - patch.y : cur.y;
      for (const it of this.selected) it.translate(new ps.Point(tx - cur.x, ty - cur.y));
    }
    this.commit();
  }

  flip(axis: "h" | "v") {
    const b = this.selectionBounds();
    if (!b) return;
    for (const it of this.selected) it.scale(axis === "h" ? -1 : 1, axis === "v" ? -1 : 1, b.center);
    this.commit();
  }

  rotateSelection(degrees: number) {
    const b = this.selectionBounds();
    if (!b || !degrees) return;
    // Screen/ruler convention: positive = counter-clockwise (y up).
    for (const it of this.selected) it.rotate(-degrees, b.center);
    this.commit();
  }

  setTextFontSize(inches: number) {
    const t = this.selected[0];
    if (!(t instanceof this.ps.PointText) || !(inches > 0)) return;
    t.fontSize = inches;
    this.commit();
  }

  // ---------------------------------------------------------------- edit ops
  private cloneWithNewIds(it: Item): Item {
    const c = it.clone({ insert: false, deep: true });
    c.data.id = newId();
    for (const d of c.getItems({})) d.data.id = undefined;
    return c;
  }

  duplicate() {
    if (!this.selected.length) return;
    const { x, y } = this.settings.duplicateOffset;
    const copies = this.selected.map((it) => {
      const c = this.cloneWithNewIds(it);
      c.insertAbove(it);
      c.translate(new this.ps.Point(x, -y));
      return c;
    });
    this.selected = copies;
    this.commit();
  }

  copy() {
    this.clipboard = this.selected.map((it) => toNode(this.ps, it)).filter((n): n is SceneNode => !!n);
  }
  cut() {
    this.copy();
    this.deleteSelection();
  }
  paste() {
    if (!this.clipboard.length) return;
    const items = this.clipboard.map((n) => fromNode(this.ps, n, (id) => this.assets.getProxy(id))).filter((i): i is Item => !!i);
    for (const it of items) {
      it.data.id = newId();
      this.contentLayer.addChild(it);
    }
    this.selected = items;
    this.commit();
  }

  deleteSelection() {
    if (this.selectedGuideId) return this.deleteGuide(this.selectedGuideId);
    if (!this.selected.length) return;
    for (const it of this.selected) it.remove();
    this.selected = [];
    this.commit();
  }

  group() {
    if (this.selected.length < 2) return;
    const ordered = [...this.selected].sort((a, b) => a.index - b.index);
    const top = ordered[ordered.length - 1];
    const g = new this.ps.Group({ insert: false });
    g.insertAbove(top);
    g.addChildren(ordered);
    g.data.id = newId();
    this.selected = [g];
    this.commit();
  }

  ungroup() {
    const out: Item[] = [];
    for (const it of this.selected) {
      if (!(it instanceof this.ps.Group)) {
        out.push(it);
        continue;
      }
      const children = [...it.children];
      for (const c of children) {
        c.clipMask = false;
        c.insertBelow(it);
        this.idOf(c);
        out.push(c);
      }
      it.remove();
    }
    this.selected = out;
    this.commit();
  }

  order(op: "front" | "back" | "forward" | "backward") {
    if (!this.selected.length) return;
    const sorted = [...this.selected].sort((a, b) => a.index - b.index);
    if (op === "front") for (const it of sorted) it.bringToFront();
    else if (op === "back") for (const it of sorted.reverse()) it.sendToBack();
    else if (op === "forward") {
      for (const it of sorted.reverse()) {
        const next = it.nextSibling;
        if (next && !this.selected.includes(next)) it.insertAbove(next);
      }
    } else {
      for (const it of sorted) {
        const prev = it.previousSibling;
        if (prev && !this.selected.includes(prev)) it.insertBelow(prev);
      }
    }
    this.commit();
  }

  align(how: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom", target: "selection" | "page" | "last") {
    if (!this.selected.length || (target !== "page" && this.selected.length < 2)) return;
    const ref =
      target === "page"
        ? new this.ps.Rectangle(0, 0, this.page.width, this.page.height)
        : target === "last"
          ? this.selected[this.selected.length - 1].bounds
          : this.selectionBounds()!;
    for (const it of this.selected) {
      if (target === "last" && it === this.selected[this.selected.length - 1]) continue;
      const b = it.bounds;
      let dx = 0;
      let dy = 0;
      if (how === "left") dx = ref.left - b.left;
      if (how === "hcenter") dx = ref.center.x - b.center.x;
      if (how === "right") dx = ref.right - b.right;
      if (how === "top") dy = ref.top - b.top;
      if (how === "vcenter") dy = ref.center.y - b.center.y;
      if (how === "bottom") dy = ref.bottom - b.bottom;
      it.translate(new this.ps.Point(dx, dy));
    }
    this.commit();
  }

  /** Equal gaps between objects ("spacing") or equally spaced centers. */
  distribute(axis: "h" | "v", mode: "spacing" | "centers") {
    if (this.selected.length < 3) return;
    const key = axis === "h" ? "x" : "y";
    const items = [...this.selected].sort((a, b) => a.bounds.center[key] - b.bounds.center[key]);
    const first = items[0].bounds;
    const last = items[items.length - 1].bounds;
    if (mode === "centers") {
      const start = first.center[key];
      const step = (last.center[key] - start) / (items.length - 1);
      items.forEach((it, i) => {
        const d = start + step * i - it.bounds.center[key];
        it.translate(new this.ps.Point(axis === "h" ? d : 0, axis === "v" ? d : 0));
      });
    } else {
      const lo = axis === "h" ? first.left : first.top;
      const hi = axis === "h" ? last.right : last.bottom;
      const total = items.reduce((s, it) => s + (axis === "h" ? it.bounds.width : it.bounds.height), 0);
      const gap = (hi - lo - total) / (items.length - 1);
      let pos = lo;
      for (const it of items) {
        const b = it.bounds;
        const d = pos - (axis === "h" ? b.left : b.top);
        it.translate(new this.ps.Point(axis === "h" ? d : 0, axis === "v" ? d : 0));
        pos += (axis === "h" ? b.width : b.height) + gap;
      }
    }
    this.commit();
  }

  setItemProps(id: string, patch: { name?: string; visible?: boolean; locked?: boolean }) {
    const it = this.contentLayer.children.find((c) => c.data.id === id);
    if (!it) return;
    if (patch.name !== undefined) it.name = patch.name.trim();
    if (patch.visible !== undefined) it.visible = patch.visible;
    if (patch.locked !== undefined) it.locked = patch.locked;
    if ((patch.locked || patch.visible === false) && this.selected.includes(it)) this.selected = this.selected.filter((s) => s !== it);
    this.commit();
  }

  addText(content: string, at: paper.Point, fontSizeIn = 1) {
    if (!content.trim()) return;
    const ps = this.ps;
    const t = new ps.PointText({ point: at, content, fontFamily: "Arial", fontSize: fontSizeIn, insert: false });
    t.fillColor = new ps.Color("#000000");
    t.data.id = newId();
    this.contentLayer.addChild(t);
    this.selected = [t];
    this.setTool("pick");
    this.commit();
  }

  // ---------------------------------------------------------------- import / place
  /** Places a parsed SVG/PDF. scale=1 keeps original size; keepPosition maps the file's page to this page. */
  async placeVector(parsed: ParsedVectorImport, opts: { scale: number; keepPosition: boolean }) {
    const ps = this.ps;
    const root = parsed.root;
    if (opts.scale !== 1) {
      root.scale(opts.scale, new ps.Point(0, 0));
      for (const p of root.getItems({ class: ps.Path }) as paper.Path[]) if (p.strokeColor) p.strokeWidth *= opts.scale;
    }
    // Swap embedded images for display proxies (originals kept as assets).
    for (const { asset, img, raster } of parsed.rasters) {
      const proxy = await this.assets.add(asset, img);
      const r = new ps.Raster({ insert: false });
      r.image = proxy;
      r.matrix = raster.matrix.clone().scale(img.naturalWidth / proxy.width, img.naturalHeight / proxy.height);
      r.data.assetId = asset.id;
      raster.replaceWith(r);
    }
    if (!opts.keepPosition) {
      const c = this.ps.view.center;
      root.translate(c.subtract(root.bounds.center));
    }
    // Unwrap the file's root (and a single layer wrapper) so pieces are selectable directly.
    let children = [...root.children];
    if (children.length === 1 && children[0] instanceof ps.Group && !(children[0] as paper.Group).clipped) children = [...children[0].children];
    for (const c of children) {
      c.data.id = newId();
      this.contentLayer.addChild(c);
    }
    this.selected = children.filter((c) => c.visible);
    this.commit();
  }

  async placeRaster(asset: RasterAsset, img: HTMLImageElement, at?: paper.Point) {
    const ps = this.ps;
    const proxy = await this.assets.add(asset, img);
    const r = new ps.Raster({ insert: false });
    r.image = proxy;
    const widthIn = asset.pxWidth / asset.dpi;
    r.scale(widthIn / proxy.width);
    r.position = at ?? this.ps.view.center;
    r.data.assetId = asset.id;
    r.data.id = newId();
    r.name = asset.name;
    this.contentLayer.addChild(r);
    this.selected = [r];
    this.commit();
  }

  // ---------------------------------------------------------------- documents
  private snapshot(): string {
    return JSON.stringify({ objects: this.contentLayer.children.map((c) => toNode(this.ps, c)).filter(Boolean), guides: this.guides, page: this.page });
  }

  private restoreSnapshot(json: string) {
    const s = JSON.parse(json) as { objects: SceneNode[]; guides: Guide[]; page: PageSize };
    const selectedIds = new Set(this.selected.map((i) => i.data.id));
    this.contentLayer.removeChildren();
    for (const n of s.objects) {
      const it = fromNode(this.ps, n, (id) => this.assets.getProxy(id));
      if (it) this.contentLayer.addChild(it);
    }
    this.guides = s.guides;
    if (s.page.width !== this.page.width || s.page.height !== this.page.height) this.setPage(s.page, false);
    this.selected = this.contentLayer.children.filter((c) => selectedIds.has(c.data.id));
    this.selectedGuideId = null;
    if (this.tool === "shape") {
      this.shape.restore(this.history.meta);
      // That step was made outside the Shape tool: keep editing the selected object.
      if (!this.shape.hasTarget && this.selected.length === 1) this.shape.enter(this.selected[0]);
    } else this.shape.clear();
    this.markChanged();
    this.viewChanged();
  }

  undo() {
    const s = this.history.undo();
    if (s) this.restoreSnapshot(s);
  }
  redo() {
    const s = this.history.redo();
    if (s) this.restoreSnapshot(s);
  }

  toDocument(): DocFile {
    const objects = this.contentLayer.children.map((c) => toNode(this.ps, c)).filter((n): n is SceneNode => !!n);
    const used = collectAssetIds(objects);
    return {
      format: DOC_FORMAT,
      version: DOC_VERSION,
      name: this.docName,
      page: { ...this.page },
      settings: structuredClone(this.settings),
      origin: { ...this.origin },
      originAtPageCorner: this.originAtPageCorner,
      guides: this.guides.map((g) => ({ ...g })),
      objects,
      assets: this.assets.all().filter((a) => used.has(a.id)),
    };
  }

  async loadDocument(doc: DocFile) {
    if (doc.format !== DOC_FORMAT) throw new Error("This isn't a Pattern Print Studio document.");
    if (doc.version > DOC_VERSION) throw new Error("This document was saved by a newer version of Pattern Print Studio.");
    this.assets.clear();
    await this.assets.addAll(doc.assets ?? []);
    this.docName = doc.name || "Untitled";
    this.page = { ...doc.page };
    this.settings = { ...structuredClone(DEFAULT_SETTINGS), ...doc.settings };
    this.origin = { ...doc.origin };
    this.originAtPageCorner = doc.originAtPageCorner ?? false;
    this.guides = doc.guides ?? [];
    this.selected = [];
    this.selectedGuideId = null;
    this.shape.clear();
    this.contentLayer.removeChildren();
    for (const n of doc.objects) {
      const it = fromNode(this.ps, n, (id) => this.assets.getProxy(id));
      if (it) this.contentLayer.addChild(it);
    }
    this.drawPage();
    this.history.reset(this.snapshot());
    this.unsaved = false;
    this.draftDirty = false;
    this.fitPage();
    this.emit();
  }

  newDocument(page: PageSize, units: DocSettings["units"], name = "Untitled") {
    this.assets.clear();
    this.shape.clear();
    this.contentLayer.removeChildren();
    this.selected = [];
    this.guides = [];
    this.docName = name;
    this.settings = { ...structuredClone(DEFAULT_SETTINGS), units };
    this.page = { ...page };
    this.origin = { x: 0, y: page.height };
    this.originAtPageCorner = true;
    this.drawPage();
    this.history.reset(this.snapshot());
    this.unsaved = false;
    this.draftDirty = false;
    this.fitPage();
    this.emit();
  }

  setDocName(name: string) {
    this.docName = name.trim() || "Untitled";
    this.markChanged();
    this.emit();
  }

  markSaved() {
    this.unsaved = false;
    this.emit();
  }
  /** True once since the last call if anything changed (for autosave). */
  takeDraftDirty(): boolean {
    const d = this.draftDirty;
    this.draftDirty = false;
    return d;
  }

  /** Inches → current view pixel position (for overlays like the text input). */
  projectToClient(p: { x: number; y: number }) {
    const v = this.ps.view.projectToView(new this.ps.Point(p.x, p.y));
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + v.x, y: r.top + v.y };
  }

  // ---------------------------------------------------------------- input
  private viewPoint(e: { clientX: number; clientY: number }) {
    const r = this.canvas.getBoundingClientRect();
    return new this.ps.Point(e.clientX - r.left, e.clientY - r.top);
  }

  /** Text tool: the UI shows an input; this is where its click landed. */
  onTextRequest: ((at: { x: number; y: number }) => void) | null = null;

  private attachEvents() {
    const c = this.canvas;
    const down = (e: PointerEvent) => this.onPointerDown(e);
    const move = (e: PointerEvent) => this.onPointerMove(e);
    const up = (e: PointerEvent) => this.onPointerUp(e);
    const leave = () => {
      this.cursor = null;
      this.emit();
    };
    const wheel = (e: WheelEvent) => this.onWheel(e);
    const ctx = (e: MouseEvent) => e.preventDefault();
    const dbl = (e: MouseEvent) => {
      // Double-click a selected guide → delete is via Delete key; double-click empty = nothing (Phase 2: node edit).
      e.preventDefault();
    };
    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up);
    c.addEventListener("pointerleave", leave);
    c.addEventListener("wheel", wheel, { passive: false });
    c.addEventListener("contextmenu", ctx);
    c.addEventListener("dblclick", dbl);
    // Safari trackpad pinch
    const gesture = (e: Event) => e.preventDefault();
    c.addEventListener("gesturestart", gesture);
    this.cleanup.push(() => {
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", up);
      c.removeEventListener("pointerleave", leave);
      c.removeEventListener("wheel", wheel);
      c.removeEventListener("contextmenu", ctx);
      c.removeEventListener("dblclick", dbl);
      c.removeEventListener("gesturestart", gesture);
    });
  }

  setSpaceDown(v: boolean) {
    if (this.spaceDown === v) return;
    this.spaceDown = v;
    if (v) this.spacePanned = false;
    if (!this.drag) this.canvas.style.cursor = v ? "grab" : this.toolCursor();
  }
  /** True if Space was used to pan since it went down (so its release is not a tap). */
  takeSpacePanned(): boolean {
    const p = this.spacePanned;
    this.spacePanned = false;
    return p;
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.ps.view.viewSize.height : 1;
    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+wheel and trackpad pinch (browsers report pinch as ctrl+wheel).
      const factor = Math.exp((-e.deltaY * scale) / 300);
      this.setPpi(this.ps.view.zoom * factor, this.viewPoint(e));
      return;
    }
    let dx = e.deltaX * scale;
    let dy = e.deltaY * scale;
    if (e.shiftKey && !dx) {
      dx = dy;
      dy = 0;
    }
    this.panBy(dx, dy);
  }

  private onPointerDown(e: PointerEvent) {
    const vp = this.viewPoint(e);
    const p = this.ps.view.viewToProject(vp);
    this.canvas.setPointerCapture?.(e.pointerId);

    if (e.button === 1 || this.spaceDown || (this.tool === "pan" && e.button === 0)) {
      e.preventDefault();
      if (this.spaceDown) this.spacePanned = true;
      this.drag = { kind: "pan", startClient: new this.ps.Point(e.clientX, e.clientY), startCenter: this.ps.view.center };
      this.canvas.style.cursor = "grabbing";
      return;
    }
    if (this.tool === "zoom") {
      if (e.button === 2 || e.altKey) return this.zoomBy(0.5, vp);
      this.drag = { kind: "zoomRect", start: p, startClient: new this.ps.Point(e.clientX, e.clientY) };
      return;
    }
    if (e.button !== 0) return;
    if (this.tool === "rectangle" || this.tool === "ellipse") {
      const targets = this.snapTargets(true);
      this.drag = { kind: "create", shape: this.tool, start: this.snapPoint(p, targets), targets };
      return;
    }
    if (this.tool === "text") {
      this.onTextRequest?.({ x: p.x, y: p.y });
      return;
    }

    if (this.tool === "shape") {
      if (this.shape.pointerDown(e, vp, p)) this.drag = { kind: "shape" };
      return;
    }

    // pick tool
    const h = this.hitHandle(vp);
    if (h) {
      const b = this.selectionBounds()!;
      if (h.rotate) {
        this.drag = { kind: "rotate", center: b.center, startAngle: p.subtract(b.center).angle, applied: 0 };
      } else {
        const opp = (h.handle + 4) % 8;
        const anchor = e.shiftKey ? b.center : this.handlePoints(b)[opp];
        this.drag = { kind: "scale", handle: h.handle, anchor, startBounds: b.clone(), sx: 1, sy: 1, targets: this.snapTargets(false), fromCenter: e.shiftKey };
      }
      return;
    }
    const hit = this.hitTestContent(vp);
    if (hit) {
      const wasSelected = this.selected.includes(hit);
      if (e.shiftKey) {
        this.select([hit], true);
        if (!this.selected.includes(hit)) return;
      } else if (!wasSelected) {
        this.select([hit]);
      }
      this.drag = { kind: "move", start: p, startBounds: this.selectionBounds()!.clone(), applied: new this.ps.Point(0, 0), moved: false, targets: this.snapTargets(false), wasSelected };
      return;
    }
    const guide = this.guideAt(vp);
    if (guide) {
      this.selected = [];
      this.selectedGuideId = guide.id;
      this.drawGuides();
      this.drag = { kind: "guide", guideId: guide.id, orientation: guide.orientation, created: false, targets: this.snapTargets(true) };
      this.emit();
      return;
    }
    if (!e.shiftKey) this.select([]);
    this.selectedGuideId = null;
    this.drawGuides();
    this.drag = { kind: "marquee", start: p, additive: e.shiftKey, touching: e.altKey };
  }

  private onPointerMove(e: PointerEvent) {
    const vp = this.viewPoint(e);
    const p = this.ps.view.viewToProject(vp);
    const ps = this.ps;
    const d = this.drag;
    this.cursor = { x: p.x, y: p.y };
    if (!d) {
      if (this.tool === "pick" && !this.spaceDown) {
        const h = this.hitHandle(vp);
        const cursors = ["nwse-resize", "ns-resize", "nesw-resize", "ew-resize", "nwse-resize", "ns-resize", "nesw-resize", "ew-resize"];
        this.canvas.style.cursor = h ? (h.rotate ? "alias" : cursors[h.handle]) : this.guideAt(vp) ? "move" : "default";
      } else if (this.tool === "shape" && !this.spaceDown) {
        this.canvas.style.cursor = this.shape.cursorAt(vp);
      }
      this.emit();
      return;
    }
    this.snapLabel = null;
    this.snapMarker = null;
    switch (d.kind) {
      case "pan": {
        const delta = new ps.Point(e.clientX, e.clientY).subtract(d.startClient).divide(ps.view.zoom);
        ps.view.center = d.startCenter.subtract(delta);
        this.viewChanged();
        return;
      }
      case "move": {
        let delta = p.subtract(d.start);
        if (!d.moved && delta.length / this.px < 3) return;
        d.moved = true;
        if (e.ctrlKey || e.metaKey) delta = Math.abs(delta.x) >= Math.abs(delta.y) ? new ps.Point(delta.x, 0) : new ps.Point(0, delta.y);
        const b = new ps.Rectangle(d.startBounds.point.add(delta), d.startBounds.size);
        const keys = [b.topLeft, b.topCenter, b.topRight, b.leftCenter, b.center, b.rightCenter, b.bottomLeft, b.bottomCenter, b.bottomRight];
        const r = snapPoints(keys, d.targets, SNAP_PX * this.px);
        if (r.label) {
          delta = delta.add(new ps.Point(r.dx, r.dy));
          this.snapLabel = r.label;
          this.snapMarker = r.at ? new ps.Point(r.at.x, r.at.y) : null;
        }
        const step = delta.subtract(d.applied);
        for (const it of this.selected) it.translate(step);
        d.applied = delta;
        break;
      }
      case "scale": {
        const sp = this.snapPoint(p, d.targets);
        const handles = this.handlePoints(d.startBounds);
        const start = handles[d.handle];
        const den = start.subtract(d.anchor);
        let sx = den.x !== 0 ? (sp.x - d.anchor.x) / den.x : 1;
        let sy = den.y !== 0 ? (sp.y - d.anchor.y) / den.y : 1;
        const corner = d.handle % 2 === 0;
        if (!corner) {
          if (d.handle === 1 || d.handle === 5) sx = 1;
          else sy = 1;
        } else {
          // Corel: corner handles scale proportionally.
          const s = Math.abs(sx - 1) > Math.abs(sy - 1) ? sx : sy;
          sx = s;
          sy = s;
        }
        const guard = (v: number) => (Math.abs(v) < 1e-4 ? (v < 0 ? -1e-4 : 1e-4) : v);
        sx = guard(sx);
        sy = guard(sy);
        for (const it of this.selected) it.scale(sx / d.sx, sy / d.sy, d.anchor);
        d.sx = sx;
        d.sy = sy;
        break;
      }
      case "rotate": {
        let angle = p.subtract(d.center).angle - d.startAngle;
        if (e.ctrlKey || e.metaKey) angle = Math.round(angle / 15) * 15;
        const step = angle - d.applied;
        for (const it of this.selected) it.rotate(step, d.center);
        d.applied = angle;
        this.snapLabel = `${(-angle).toFixed(1)}°`;
        break;
      }
      case "marquee":
        this.marqueeRect = new ps.Rectangle(d.start, p);
        break;
      case "create": {
        const sp = this.snapPoint(p, d.targets);
        let r = new ps.Rectangle(d.start, sp);
        if (e.ctrlKey || e.metaKey) {
          const s = Math.max(r.width, r.height);
          r = new ps.Rectangle(d.start, d.start.add(new ps.Point(Math.sign(sp.x - d.start.x) * s, Math.sign(sp.y - d.start.y) * s)));
        }
        if (e.shiftKey) r = new ps.Rectangle(d.start.subtract(sp.subtract(d.start)), sp);
        this.marqueeRect = r;
        break;
      }
      case "zoomRect":
        this.marqueeRect = new ps.Rectangle(d.start, p);
        break;
      case "guide": {
        const sp = this.snapPoint(p, d.targets);
        this.setGuidePos(d.guideId, d.orientation === "h" ? sp.y : sp.x);
        break;
      }
      case "origin": {
        const sp = this.snapPoint(p, d.targets);
        this.origin = { x: sp.x, y: sp.y };
        this.originAtPageCorner = false;
        this.viewChanged();
        break;
      }
      case "shape":
        this.shape.pointerMove(e, p);
        break;
    }
    this.drawOverlay();
    this.emit();
  }

  private onPointerUp(e: PointerEvent) {
    const d = this.drag;
    this.drag = null;
    this.snapMarker = null;
    const vp = this.viewPoint(e);
    const ps = this.ps;
    if (!d) return;
    switch (d.kind) {
      case "pan":
        this.canvas.style.cursor = this.spaceDown ? "grab" : this.toolCursor();
        break;
      case "move":
        if (d.moved) this.commit();
        else if (d.wasSelected && !e.shiftKey) {
          // Corel: click an already-selected object again → rotate handles.
          this.rotateMode = !this.rotateMode;
        }
        break;
      case "scale":
      case "rotate":
        this.commit();
        break;
      case "marquee": {
        const r = this.marqueeRect;
        this.marqueeRect = null;
        if (r && r.width * this.ps.view.zoom > 2 && r.height * this.ps.view.zoom > 2) {
          const hits = this.contentLayer.children.filter((c) => c.visible && !c.locked && (d.touching ? r.intersects(c.bounds) : r.contains(c.bounds)));
          this.select(hits, d.additive);
        }
        break;
      }
      case "create": {
        const r = this.marqueeRect;
        this.marqueeRect = null;
        if (r && r.width > 0 && r.height > 0) {
          const shape = d.shape === "rectangle" ? new ps.Path.Rectangle({ rectangle: r, insert: false }) : new ps.Path.Ellipse({ rectangle: r, insert: false });
          shape.strokeColor = new ps.Color("#000000");
          shape.strokeWidth = NEW_SHAPE_STROKE;
          shape.data.id = newId();
          // Stays a "shape" until converted to curves (Ctrl+Q); the Shape tool shows a hint for it.
          shape.data.shape = d.shape;
          this.contentLayer.addChild(shape);
          this.selected = [shape];
          this.commit();
        }
        break;
      }
      case "zoomRect": {
        const r = this.marqueeRect;
        this.marqueeRect = null;
        if (r && r.width * this.ps.view.zoom > 6) this.fitRect(r, 10);
        else this.zoomBy(2, vp);
        break;
      }
      case "guide": {
        // Dropped back on a ruler (outside the canvas) → delete.
        const outside = d.orientation === "h" ? vp.y < 0 : vp.x < 0;
        if (outside) {
          this.guides = this.guides.filter((g) => g.id !== d.guideId);
          this.selectedGuideId = null;
          this.drawGuides();
        }
        this.commit();
        break;
      }
      case "origin":
        this.markChanged();
        break;
      case "shape":
        this.shape.pointerUp(e);
        break;
    }
    this.snapLabel = null;
    this.drawOverlay();
    this.emit();
  }
}
