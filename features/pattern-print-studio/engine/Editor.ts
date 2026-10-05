import paper from "paper/dist/paper-core";
import { AssetStore, loadImageElement, newId } from "./assets";
import { rebuildGrid } from "./grid";
import { installHairlineMinimum } from "./hairline";
import { getOutlineFont, loadStudioFontFaces, STUDIO_FONT } from "./fonts";
import { History } from "./history";
import { clipGroupOf, clipOwner, contentsOf, DEFAULT_CLIP, frameOf, insideClipContents, isClosedOutline, isDerived, isPowerClip, syncMask, syncRepeatHolder, tileHolderOf, unwrapPowerClip, wrapInPowerClip } from "./powerclip";
import { cellMatrix, countCells, coverInRepeatSpace, defaultRepeat, deltaInRepeatSpace, repeatCells, repeatSteps, type RepeatSettings } from "./repeat";
import { collectAssetIds, fromNode, toNode, type SceneNode } from "./serialize";
import { anchorOf, dpiLevel, effectiveDpi, fillScale, fitScale } from "./clip-fit";
import type { NodeType } from "./node-geometry";
import { DEFAULT_SIMPLIFY_TOLERANCE, ShapeTool, type NodeEditState, type OpenPathInfo, type ShapeMeta } from "./shape-tool";
import { missingGlyphs, nodeCount, planShaping, textToOutlines, type ShapingOp, type ShapingPlan } from "./shaping";
import { buildTargets, snapPoints, SNAP_PX, type SnapTargets } from "./snap";
import { DEFAULT_PAGE, DEFAULT_SETTINGS, type DocSettings, type Guide, type Orientation, type Origin, type PageSize, type RasterAsset, type ToolId } from "./types";
import type { TraceResult } from "./trace/trace-core";
import { clamp, CSS_PX_PER_INCH, MAX_ZOOM_PCT, MIN_ZOOM_PCT } from "./units";
import type { ParsedVectorImport } from "./import-svg";

type Item = paper.Item;
type Rect = { x: number; y: number; w: number; h: number };

export const DOC_FORMAT = "supplybase.pattern-print-studio";
// 2: PowerClips (Phase 3). Version 1 files open unchanged; older builds refuse a version 2 file rather than drop its prints.
export const DOC_VERSION = 2;

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
  /** 0 = on the page; deeper rows are PowerClips inside groups and the prints inside a PowerClip. */
  depth: number;
  role: "object" | "clip" | "content";
}

/** The print being adjusted inside a frame. Positions are the print's anchor point relative to the frame's same anchor point. */
export interface ClipContentState {
  /** Inches, right of the frame's anchor. */
  x: number;
  /** Inches, ABOVE the frame's anchor (like the rulers). */
  y: number;
  /** The print's own width and height (not its rotated bounding box). */
  w: number;
  h: number;
  /** Degrees, counter-clockwise. */
  rotation: number;
  /** Several prints are selected: they are treated as one box. */
  multiple: boolean;
  /** Effective DPI of a bitmap at its current size, from the ORIGINAL file. Null for vectors. */
  dpi: number | null;
  dpiLevel: "ok" | "low" | "bad" | null;
  /** The print's proportions differ from the frame's (Stretch would distort it). */
  stretchDistorts: boolean;
}

export type ClipFit = "center" | "fit" | "fill" | "stretch" | "top";

/** The PowerClip the floating Edit / Finish / Extract / Lock bar belongs to. */
export interface ClipState {
  id: string;
  /** Its contents are being edited (the whole print is shown, faded outside the frame). */
  editing: boolean;
  lock: boolean;
  /** Number of prints inside. */
  count: number;
  /** Repeat fill settings, when on. */
  repeat: RepeatSettings | null;
  /** Repeat tiles currently drawn, and how many were left out because the tile is too small at this zoom. */
  tiles: { drawn: number; skipped: number } | null;
  /** Where the bar goes: bottom-centre of the frame, page inches. */
  anchor: { x: number; y: number };
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
  /** Exactly one bitmap is selected (it can be traced). */
  selectedBitmap: boolean;
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
  /** Shaping panel: the chosen operation and what its live preview found. */
  shaping: ShapingState | null;
  /** The active PowerClip (selected, or being edited), if any. */
  clip: ClipState | null;
  /** While editing a PowerClip: the selected print, measured against the frame. */
  clipContent: ClipContentState | null;
  /** "Place inside frame" is waiting for a click on an outline. */
  placing: boolean;
  /** After a right-mouse drag onto an outline: where to show the "PowerClip inside" menu (client px). */
  clipMenu: { x: number; y: number } | null;
}

/** A bitmap ready to be traced: its ORIGINAL pixels (not the on-screen proxy) and its real size on the page. */
export interface TraceSource {
  id: string;
  name: string;
  image: HTMLImageElement;
  widthIn: number;
  heightIn: number;
}

export interface ShapingState {
  op: ShapingOp;
  keepSource: boolean;
  keepTarget: boolean;
  /** False when the operation can't be applied to the current selection (see `message`). */
  ok: boolean;
  message: string;
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
  | { kind: "shape" }
  | { kind: "rdrag"; startClient: paper.Point; moved: boolean }
  | { kind: "repeat"; start: paper.Point; baseX: number; baseY: number; moved: boolean };

const HANDLE_PX = 7;
const HIT_PX = 5;
const SELECT_COLOR = "#2563eb";
const GUIDE_COLOR = "#2563eb";
const GUIDE_SELECTED_COLOR = "#dc2626";
const NEW_SHAPE_STROKE = 0.01; // inches
/** Most repeat tiles drawn for one piece at a time; beyond this the tile is too small to matter at that zoom. */
const MAX_TILES = 6000;
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
  private shaping: { op: ShapingOp; keepSource: boolean; keepTarget: boolean } | null = null;
  private shapingPlan: ShapingPlan | null = null;
  private shapingMessage = "";
  private shapingDirty = false;
  /** PowerClip: the one the mini toolbar acts on, the one whose contents are being edited, and pending placements. */
  private activeClip: paper.Group | null = null;
  private clipEdit: paper.Group | null = null;
  private placing: Item[] | null = null;
  private clipMenu: { x: number; y: number; frame: Item; contents: Item[] } | null = null;
  private clipList: paper.Group[] | null = null;
  private lastOpenOutline: Item | null = null;
  /** Repeat fill: cached tile definitions (per tile holder), clips whose tiles must be rebuilt, and tile counts for the UI. */
  private tileDefs = new WeakMap<Item, paper.SymbolDefinition>();
  private dirtyRepeats = new Set<paper.Group>();
  private repeatInfo = new WeakMap<Item, { tiles: number; skipped: number }>();
  /** While choosing a frame: the outline the print would go into (highlighted). */
  private frameHover: Item | null = null;
  /** Reports the outcome of pointer-driven PowerClip actions (shown as a toast). */
  onNotice: ((r: { ok: boolean; message: string; action?: "check-outlines" }) => void) | null = null;
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
      topLevel: (item) => this.rootOf(item),
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

    // Text is drawn in the bundled font; redraw once it has arrived.
    loadStudioFontFaces().then(() => this.ps.view?.requestUpdate()); // view is gone if the editor was already destroyed

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
      selectedBitmap: single instanceof this.ps.Raster,
      objects: this.objectRows(),
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      unsaved: this.unsaved,
      refPoint: this.refPoint,
      lockAspect: this.lockAspect,
      cursor: this.cursor,
      snapLabel: this.snapLabel,
      rotateMode: this.rotateMode,
      nodeEdit: this.tool === "shape" ? this.shape.state() : null,
      shaping: this.shaping ? { ...this.shaping, ok: !!this.shapingPlan, message: this.shapingMessage } : null,
      clip: this.clipState(),
      clipContent: this.clipContentState(),
      placing: !!this.placing,
      clipMenu: this.clipMenu ? { x: this.clipMenu.x, y: this.clipMenu.y } : null,
    };
  }

  /** Objects panel rows: page objects top-down, with PowerClips (also inside groups) and their prints nested under them. */
  private objectRows(): ObjectEntry[] {
    const rows: ObjectEntry[] = [];
    const current = this.currentClip();
    const row = (it: Item, depth: number, role: ObjectEntry["role"]) =>
      rows.push({ id: this.idOf(it), name: it.name || this.kindOf(it), kind: this.kindOf(it), visible: it.visible, locked: it.locked, selected: this.selected.includes(it) || it === current, depth, role });
    const walk = (it: Item, depth: number) => {
      if (isPowerClip(it)) {
        for (const c of contentsOf(it).reverse()) row(c, depth + 1, "content");
      } else if (it instanceof this.ps.Group) {
        for (const c of [...it.children].reverse()) {
          if (!isPowerClip(c) && !(c instanceof this.ps.Group && c.getItem({ match: isPowerClip }))) continue;
          row(c, depth + 1, isPowerClip(c) ? "clip" : "object");
          walk(c, depth + 1);
        }
      }
    };
    for (const it of [...this.contentLayer.children].reverse()) {
      row(it, 0, isPowerClip(it) ? "clip" : "object");
      walk(it, 0);
    }
    return rows;
  }

  /** The PowerClip in focus: the one being edited, the one last clicked (still selected), or a lone selected PowerClip. */
  private currentClip(): paper.Group | null {
    if (this.clipEdit) return this.clipEdit;
    const a = this.activeClip;
    if (a && a.isInserted() && this.selected.includes(this.rootOf(a) as Item)) return a;
    return this.selected.length === 1 && isPowerClip(this.selected[0]) ? this.selected[0] : null;
  }

  private clipState(): ClipState | null {
    const pc = this.currentClip();
    const frame = pc && frameOf(pc);
    if (!pc || !frame) return null;
    const b = frame.bounds;
    const info = this.repeatInfo.get(pc);
    return { id: this.idOf(pc), editing: pc === this.clipEdit, lock: !!pc.data.pc.lock, count: contentsOf(pc).length, repeat: pc.data.pc.repeat ?? null, tiles: info ? { drawn: info.tiles, skipped: info.skipped } : null, anchor: { x: b.center.x, y: b.bottom } };
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
    // Repeat tiles are only built for what is on screen, so a pan or zoom needs them rebuilt.
    this.refreshRepeats(true);
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
    if (isPowerClip(item)) return `PowerClip (${contentsOf(item).length} inside)`;
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
  /** What the Pick tool works in: the page, or the inside of the PowerClip being edited. */
  private get scope(): Item {
    return this.clipEdit ? clipGroupOf(this.clipEdit) : this.contentLayer;
  }
  /** The selectable object an item belongs to, within the current scope. */
  private topLevel(item: Item | null): Item | null {
    const scope = this.scope;
    while (item && item.parent !== scope) item = item.parent;
    return item;
  }
  /** The page-level object an item belongs to, whatever is being edited. */
  private rootOf(item: Item | null): Item | null {
    while (item && item.parent !== this.contentLayer) item = item.parent;
    return item;
  }
  private findById(id: string): Item | null {
    return this.contentLayer.getItem({ match: (it: Item) => it.data?.id === id }) ?? null;
  }
  /** Applies a transform to an object. An unlocked PowerClip moves its frame only; the print stays where it is. */
  private tf(it: Item, fn: (target: Item) => void, info?: { rotate?: number; sx?: number; sy?: number }) {
    if (isPowerClip(it) && !it.data.pc.lock) {
      fn(frameOf(it));
      syncMask(this.ps, it, it !== this.clipEdit);
      if (it.data.pc.repeat) this.dirtyRepeats.add(it);
    } else {
      fn(it);
      if (info) this.fixRepeatsAfterTransform(it, info);
    }
  }
  private markChanged() {
    this.unsaved = true;
    this.draftDirty = true;
  }
  /** Records an undo step after a committed action. */
  commit() {
    this.shapingDirty = true;
    this.clipList = null;
    // Contents may have changed: tile definitions are rebuilt from the artwork.
    this.tileDefs = new WeakMap();
    this.refreshRepeats(true);
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
    if (tool !== "pick") {
      this.placing = null;
      this.clipMenu = null;
    }
    if (tool === "shape" && was !== "shape") {
      // Node editing works on outlines, not on the inside of a PowerClip.
      if (this.clipEdit) this.finishClipEdit();
      // Start on the selected object, like switching to the Shape tool in Corel. A PowerClip opens on its frame.
      const only = this.selected.length === 1 ? this.selected[0] : null;
      this.shape.enter(only && isPowerClip(only) ? frameOf(only) : only);
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
    // A frame being node-edited: its clip follows the outline on every redraw.
    const edited = this.tool === "shape" ? clipOwner(this.shape.targetItem) : null;
    if (edited) {
      syncMask(this.ps, edited);
      if (edited.data.pc.repeat) this.dirtyRepeats.add(edited);
    }
    if (this.dirtyRepeats.size) this.refreshRepeats(false);
    this.drawCutLines(ctx, dpr);
    if (this.frameHover && (this.placing || this.drag?.kind === "rdrag") && this.frameHover.isInserted()) {
      // The outline the print is about to go into: blue if it can be a frame, amber if it is open.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.strokeStyle = isClosedOutline(this.ps, this.frameHover) ? SELECT_COLOR : "#d97706";
      ctx.lineWidth = 3;
      this.traceOutlines(ctx, [this.frameHover]);
      ctx.stroke();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else this.frameHover = null;
    if (this.shaping && !this.drag) {
      if (this.shapingDirty) this.computeShaping();
      if (this.shapingPlan) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.strokePreview(ctx, this.shapingPlan.results.map((r) => r.item));
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    }
    if (this.tool !== "shape") return;
    this.shape.validate();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.shape.draw(ctx, this.nodeCanvas.width / dpr, this.nodeCanvas.height / dpr);
  }

  /** Every PowerClip in the document, also inside groups (cached until the next change). */
  private clips(): paper.Group[] {
    if (!this.clipList) this.clipList = this.contentLayer.getItems({ match: isPowerClip }) as paper.Group[];
    return this.clipList;
  }

  /**
   * Cut lines: each PowerClip's outline drawn ON TOP of its print. Drawn on
   * the overlay straight from the frame's live geometry, so it follows node
   * edits and never touches the outline's own stroke.
   */
  private drawCutLines(ctx: CanvasRenderingContext2D, dpr: number) {
    const cut = this.settings.cutLines;
    if (!cut?.visible) return;
    const view = this.ps.view.bounds;
    const frames = this.clips()
      .filter((pc) => pc.isInserted() && (this.rootOf(pc)?.visible ?? false))
      .map((pc) => frameOf(pc))
      .filter((f) => f && f.bounds.intersects(view));
    if (!frames.length) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = cut.color;
    // Real width when zoomed in; never thinner than one screen pixel.
    ctx.lineWidth = Math.max(1, cut.width * this.ps.view.zoom);
    ctx.lineJoin = "round";
    this.traceOutlines(ctx, frames);
    ctx.stroke();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Outlines not-yet-applied result shapes in pink on the overlay canvas. */
  private strokePreview(ctx: CanvasRenderingContext2D, items: paper.PathItem[]) {
    ctx.strokeStyle = "#d946ef";
    ctx.fillStyle = "rgba(217, 70, 239, 0.12)";
    ctx.lineWidth = 2;
    this.traceOutlines(ctx, items);
    ctx.fill("evenodd");
    ctx.stroke();
  }

  /** Adds the outlines of paths / compound paths to the overlay's current path, in screen pixels. */
  private traceOutlines(ctx: CanvasRenderingContext2D, items: Item[]) {
    const ps = this.ps;
    const zoom = ps.view.zoom;
    const tl = ps.view.bounds.topLeft;
    const X = (p: paper.Point) => (p.x - tl.x) * zoom;
    const Y = (p: paper.Point) => (p.y - tl.y) * zoom;
    ctx.beginPath();
    for (const item of items) {
      for (const path of item instanceof ps.CompoundPath ? (item.children as paper.Path[]) : [item as paper.Path]) {
        for (const c of path.curves) {
          if (c.index === 0) ctx.moveTo(X(c.point1), Y(c.point1));
          const h1 = c.point1.add(c.handle1);
          const h2 = c.point2.add(c.handle2);
          ctx.bezierCurveTo(X(h1), Y(h1), X(h2), Y(h2), X(c.point2), Y(c.point2));
        }
        if (path.closed) ctx.closePath();
      }
    }
  }

  // ---------------------------------------------------------------- convert to curves / combine / shaping
  /** Replaces one item (text, or a rectangle/ellipse still marked as a shape) with plain curves. Groups are converted inside. */
  private async convertItem(item: Item, notes: Set<string>): Promise<Item> {
    const ps = this.ps;
    if (item instanceof ps.Group) {
      for (const c of [...item.children]) await this.convertItem(c, notes);
      return item;
    }
    if (item instanceof ps.Path && item.data.shape) {
      delete item.data.shape;
      notes.add("converted");
      return item;
    }
    if (!(item instanceof ps.PointText)) return item;
    const font = await getOutlineFont(item.fontWeight);
    const missing = missingGlyphs(item.content, font);
    if (missing.length) notes.add(`missing:${missing.join("")}`);
    if (!/arimo|arial|helvetica/i.test(String(item.fontFamily))) notes.add(`font:${item.fontFamily}`);
    const outlines = textToOutlines(ps, item, font);
    if (outlines.isEmpty()) return item;
    outlines.data = item.data.id ? { id: item.data.id } : {};
    outlines.name = item.name || `Text "${item.content.slice(0, 16)}"`;
    outlines.visible = item.visible;
    outlines.locked = item.locked;
    item.replaceWith(outlines);
    notes.add("converted");
    return outlines;
  }

  /**
   * Convert to curves (Ctrl+Q): text and rectangles/ellipses become editable
   * outlines, in place. One undo step. Resolves to a message for the user.
   */
  async convertToCurves(): Promise<{ ok: boolean; message: string }> {
    const nested = this.tool === "shape" ? this.shape.convertible : null;
    // In the Shape tool only the clicked object converts, never the whole group it sits in.
    if (this.tool === "shape" && !nested) return { ok: false, message: "Click the text, rectangle or ellipse you want to convert." };
    const items = nested ? [nested] : [...this.selected];
    if (!items.length) return { ok: false, message: "Select text, a rectangle or an ellipse to convert." };
    const notes = new Set<string>();
    const converted: Item[] = [];
    try {
      for (const it of items) converted.push(await this.convertItem(it, notes));
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Couldn't convert to curves." };
    }
    if (!notes.has("converted")) return { ok: false, message: "Nothing to convert — the selection is already curves." };
    if (nested) this.shape.enter(converted[0]);
    else this.selected = converted.map((c) => this.topLevel(c)).filter((c): c is Item => !!c);
    this.commit();
    const extra: string[] = [];
    for (const n of notes) {
      if (n.startsWith("missing:")) extra.push(`No outline for: ${n.slice(8)}`);
      if (n.startsWith("font:")) extra.push(`"${n.slice(5)}" isn't available as outlines, so ${STUDIO_FONT} was used — check the shape`);
    }
    return { ok: true, message: ["Converted to curves", ...extra].join(". ") };
  }

  /** Combine (Ctrl+L): the selected curves become one curve with several subpaths; overlaps become holes. Takes the last selected object's look. */
  combine(): { ok: boolean; message: string } {
    const ps = this.ps;
    if (this.selected.length < 2) return { ok: false, message: "Select two or more curves to combine." };
    for (const it of this.selected) {
      if (it instanceof ps.PointText) return { ok: false, message: "Convert the text to curves first (Ctrl+Q)." };
      if (!(it instanceof ps.Path || it instanceof ps.CompoundPath)) return { ok: false, message: "Combine works on curves only — ungroup first, and bitmaps can't be combined." };
    }
    const ordered = [...this.selected].sort((a, b) => a.index - b.index);
    const look = this.selected[this.selected.length - 1];
    const cp = new ps.CompoundPath({ insert: false });
    cp.copyAttributes(look, false);
    cp.data = { id: newId() };
    cp.fillRule = "evenodd";
    cp.insertAbove(ordered[ordered.length - 1]);
    for (const it of ordered) {
      const pieces = it instanceof ps.CompoundPath ? [...it.children] : [it];
      for (const p of pieces) {
        delete p.data.id;
        delete p.data.shape;
        cp.addChild(p);
      }
      if (it instanceof ps.CompoundPath) it.remove();
    }
    this.selected = [cp];
    this.commit();
    return { ok: true, message: `Combined into one curve (${cp.children.length} subpaths)` };
  }

  /** Break apart (Ctrl+K): each subpath of a combined curve becomes its own object. */
  breakApart(): { ok: boolean; message: string } {
    const ps = this.ps;
    const compounds = this.selected.filter((it): it is paper.CompoundPath => it instanceof ps.CompoundPath && it.children.length > 1);
    if (!compounds.length) return { ok: false, message: "Select a combined curve (one with several subpaths) to break apart." };
    const out: Item[] = this.selected.filter((it) => !compounds.includes(it as paper.CompoundPath));
    for (const cp of compounds) {
      for (const child of [...cp.children] as paper.Path[]) {
        const own = { ...child.data };
        child.copyAttributes(cp, false);
        child.data = { ...own, id: newId() };
        child.insertBelow(cp);
        out.push(child);
      }
      cp.remove();
    }
    this.selected = out;
    this.commit();
    return { ok: true, message: `Broken apart into ${out.length} curves` };
  }

  private computeShaping() {
    this.shapingDirty = false;
    this.shapingPlan = null;
    this.shapingMessage = "";
    if (!this.shaping) return;
    try {
      const plan = planShaping(this.ps, this.selected, this.shaping.op);
      this.shapingPlan = plan;
      const nodes = plan.results.reduce((n, r) => n + nodeCount(this.ps, r.item), 0);
      this.shapingMessage = `Result: ${plan.results.length} shape${plan.results.length === 1 ? "" : "s"}, ${nodes} nodes (pink preview)`;
    } catch (err) {
      // Paper's boolean code can throw on degenerate geometry; never let that reach the document.
      this.shapingMessage = err instanceof Error && err.message ? err.message : "This shaping operation couldn't be worked out for these shapes.";
    }
  }

  /** Shaping panel: choose an operation (or null to close). Shows a live preview; nothing changes until applyShaping(). */
  setShaping(op: ShapingOp | null, opts: { keepSource?: boolean; keepTarget?: boolean } = {}) {
    this.shaping = op ? { op, keepSource: opts.keepSource ?? this.shaping?.keepSource ?? false, keepTarget: opts.keepTarget ?? this.shaping?.keepTarget ?? false } : null;
    this.shapingDirty = true;
    this.shapingPlan = null;
    this.shapingMessage = "";
    this.drawOverlay();
    this.emit();
  }

  /** Applies the previewed shaping result: one undo step, results stay exactly in place. */
  applyShaping(): { ok: boolean; message: string } {
    if (!this.shaping) return { ok: false, message: "Choose a shaping operation first." };
    if (this.shapingDirty) this.computeShaping();
    const plan = this.shapingPlan;
    if (!plan) return { ok: false, message: this.shapingMessage || "Nothing to apply." };
    const { keepSource, keepTarget } = this.shaping;
    const results: Item[] = [];
    for (const { item, target } of plan.results) {
      item.data.id = keepTarget ? newId() : (target.data.id ?? newId());
      item.insertAbove(target);
      results.push(item);
    }
    if (!keepTarget) for (const t of plan.targets) t.remove();
    if (!keepSource) for (const s of plan.sources) s.remove();
    this.shapingPlan = null;
    this.selected = results;
    this.commit();
    return { ok: true, message: "Shaping applied" };
  }

  // ---------------------------------------------------------------- PowerClip
  /** The innermost PowerClip under a page point (its frame or its print), or null. */
  private clipAt(p: paper.Point): paper.Group | null {
    const res = this.contentLayer.hitTest(p, {
      fill: true,
      stroke: true,
      segments: false,
      tolerance: HIT_PX * this.px,
      match: (h: paper.HitResult) => {
        const root = this.rootOf(h.item);
        return !!root && root.visible && !root.locked && !isDerived(h.item);
      },
    });
    return res ? clipOwner(res.item) : null;
  }

  /**
   * The outline a print would be placed into at this point. Aim at a line to
   * choose that outline exactly; click inside a piece (pattern pieces have no
   * fill) to get the closed outline around the pointer — the solid cut line
   * rather than a dashed stitch line inside it, and the smallest one if
   * several are nested. The result may be an open outline, which can't be a frame.
   */
  private frameAt(p: paper.Point, exclude: Item[]): { frame: Item } | { open: Item } | null {
    const ps = this.ps;
    const skip = (it: Item) => {
      if (isDerived(it) || insideClipContents(it)) return true;
      const root = this.rootOf(it);
      if (!root || !root.visible || root.locked) return true;
      return exclude.some((x) => x === it || it.isDescendant(x));
    };
    const near = this.shape.outlineAt(p);
    if (near && !skip(near) && (near instanceof ps.Path || near instanceof ps.CompoundPath) && (near instanceof ps.CompoundPath || near.segments.length > 2)) {
      return isClosedOutline(ps, near) ? { frame: near } : { open: near };
    }
    let best: Item | null = null;
    let bestRank = Infinity;
    for (const it of this.contentLayer.getItems({ match: (i: Item) => i instanceof ps.CompoundPath || (i instanceof ps.Path && !(i.parent instanceof ps.CompoundPath)) })) {
      if (skip(it) || !isClosedOutline(ps, it) || !it.bounds.contains(p) || !(it as paper.Path).contains(p)) continue;
      // Solid outlines first, then the smallest.
      const rank = Math.abs((it as paper.Path).area) + (it.dashArray?.length ? 1e9 : 0);
      if (rank < bestRank) {
        bestRank = rank;
        best = it;
      }
    }
    return best ? { frame: best } : null;
  }

  /** Object > PowerClip > Place Inside Frame: the next click on an outline places the selected print(s) inside it. */
  beginPlaceInside(): { ok: boolean; message: string } {
    if (this.clipEdit) this.finishClipEdit();
    if (!this.selected.length) return { ok: false, message: "Select the print to place first." };
    this.setTool("pick");
    this.placing = [...this.selected];
    this.canvas.style.cursor = "crosshair";
    this.emit();
    return { ok: true, message: "Now click the pattern outline to place it inside (Esc to cancel)." };
  }
  cancelPlaceInside() {
    if (!this.placing && !this.clipMenu) return false;
    this.placing = null;
    this.clipMenu = null;
    this.canvas.style.cursor = this.toolCursor();
    this.emit();
    return true;
  }
  /** "PowerClip inside" chosen from the menu shown after a right-mouse drag. */
  confirmClipMenu(): { ok: boolean; message: string } {
    const m = this.clipMenu;
    this.clipMenu = null;
    if (!m) return { ok: false, message: "Nothing to place." };
    return this.placeInside(m.contents, { frame: m.frame });
  }

  /**
   * Places objects inside an outline. Nothing moves or resizes: the print
   * keeps its exact page position, the frame only hides what is outside it.
   * One undo step.
   */
  private placeInside(contents: Item[], target: { frame: Item } | { open: Item } | null): { ok: boolean; message: string; action?: "check-outlines" } {
    contents = contents.filter((c) => c.isInserted());
    if (!contents.length) return { ok: false, message: "Select the print to place first." };
    if (!target) return { ok: false, message: "Click inside a closed pattern outline to place the print." };
    if ("open" in target) {
      this.lastOpenOutline = target.open;
      return { ok: false, message: "Close this outline first — a print can only be placed inside a closed outline.", action: "check-outlines" };
    }
    const frame = target.frame;
    if (contents.some((c) => c === frame || frame.isDescendant(c))) return { ok: false, message: "A print can't be placed inside itself — choose another outline." };
    const ordered = [...contents].sort((a, b) => a.index - b.index);
    let pc = frame.parent && isPowerClip(frame.parent) ? frame.parent : null;
    if (pc) {
      // The outline already holds a print: add these on top of it.
      clipGroupOf(pc).addChildren(ordered);
      syncMask(this.ps, pc);
    } else {
      pc = wrapInPowerClip(this.ps, frame, ordered, DEFAULT_CLIP);
      pc.data.id = newId();
      if (frame.name) pc.name = frame.name;
    }
    for (const c of ordered) this.idOf(c);
    this.activeClip = pc;
    const root = this.rootOf(pc);
    this.selected = root ? [root] : [];
    this.rotateMode = false;
    this.commit();
    return { ok: true, message: "Placed inside the frame. Double-click it to adjust the print." };
  }

  /** Shows the whole print (faded outside the frame) and points the Pick tool at the contents. */
  private openClip(pc: paper.Group) {
    const ps = this.ps;
    const frame = frameOf(pc);
    this.clipEdit = pc;
    this.activeClip = pc;
    // A repeat fill is adjusted in place (it has no single object to drag), so the frame keeps clipping it.
    if (pc.data.pc.repeat) return;
    clipGroupOf(pc).clipped = false;
    // Veil: everything outside the frame is washed out; inside stays normal.
    const far = frame.bounds.expand(4000);
    const hole = frame.clone({ insert: false, deep: true });
    const veil = new ps.CompoundPath({ insert: false });
    veil.addChild(new ps.Path.Rectangle({ rectangle: far, insert: false }));
    for (const c of hole instanceof ps.CompoundPath ? [...hole.children] : [hole]) veil.addChild(c);
    veil.fillRule = "evenodd";
    veil.fillColor = new ps.Color(1, 1, 1, 0.68);
    veil.strokeColor = null;
    veil.data = { derived: true, pcVeil: true };
    for (const c of veil.children) c.data = {};
    veil.insertBelow(frame);
    this.clipEdit = pc;
    this.activeClip = pc;
  }

  /** Edit contents: double-click / Ctrl+click the frame, or the Edit button. */
  editClip(pc: paper.Group | null = this.currentClip()) {
    if (!pc || !isPowerClip(pc)) return;
    if (this.clipEdit) this.finishClipEdit();
    if (this.tool !== "pick") this.setTool("pick");
    this.openClip(pc);
    this.selected = pc.data.pc.repeat ? [] : contentsOf(pc).filter((c) => c.visible && !c.locked);
    this.rotateMode = false;
    this.selectedGuideId = null;
    this.drawGuides();
    this.drawOverlay();
    this.emit();
  }

  /** Finish editing: Esc, click outside, or the Finish button. The frame clips the print again. */
  finishClipEdit() {
    const pc = this.clipEdit;
    if (!pc) return false;
    this.clipEdit = null;
    if (pc.isInserted()) {
      for (const c of [...pc.children]) if (c.data?.pcVeil) c.remove();
      syncMask(this.ps, pc);
      this.activeClip = pc;
      const root = this.rootOf(pc);
      this.selected = root ? [root] : [];
    } else this.selected = [];
    this.rotateMode = false;
    this.drawOverlay();
    this.emit();
    return true;
  }

  /** Extract contents: the prints come back out as normal objects, exactly where they were. */
  extractClip(pc: paper.Group | null = this.currentClip()): { ok: boolean; message: string } {
    if (!pc || !isPowerClip(pc)) return { ok: false, message: "Select a PowerClip to extract its contents." };
    if (this.clipEdit) this.finishClipEdit();
    const topLevel = pc.parent === this.contentLayer;
    const root = this.rootOf(pc);
    const { frame, contents } = unwrapPowerClip(pc);
    this.activeClip = null;
    this.selected = topLevel ? (contents.length ? contents : [frame]) : root ? [root] : [];
    this.commit();
    return { ok: true, message: contents.length ? "Contents extracted" : "The frame was empty" };
  }

  /** Lock contents to frame (on by default). */
  setClipLock(lock: boolean, pc: paper.Group | null = this.currentClip()) {
    if (!pc || !isPowerClip(pc)) return;
    pc.data.pc = { ...pc.data.pc, lock };
    this.commit();
  }

  /** From the "Close this outline first" message: opens that outline in the Shape tool with its loose ends selected. */
  fixOpenOutline() {
    const item = this.lastOpenOutline;
    this.lastOpenOutline = null;
    if (!item || !item.isInserted()) return;
    if (this.tool !== "shape") this.setTool("shape");
    const bounds = this.shape.enterOpenItem(item);
    if (bounds) this.fitRect(bounds.expand(Math.max(bounds.width, bounds.height) * 0.1 + 0.25));
    this.drawOverlay();
    this.emit();
  }

  toggleCutLines() {
    this.updateSettings({ cutLines: { ...this.settings.cutLines, visible: !this.settings.cutLines.visible } });
  }

  // ---------------------------------------------------------------- PowerClip: exact adjustment inside the frame
  /** A print's own size, rotation (degrees counter-clockwise) and DPI. Bitmaps carry these in their matrix; vectors remember their rotation. */
  private printMetrics(it: Item): { w: number; h: number; rot: number; dpi: number | null } {
    const ps = this.ps;
    if (it instanceof ps.Raster) {
      const m = it.matrix;
      const w = Math.hypot(m.a, m.b) * it.width;
      const h = Math.hypot(m.c, m.d) * it.height;
      const asset = this.assets.get(it.data.assetId);
      return { w, h, rot: (-Math.atan2(m.b, m.a) * 180) / Math.PI, dpi: asset && w > 0 && h > 0 ? effectiveDpi(asset.pxWidth, asset.pxHeight, w, h) : null };
    }
    const rot = typeof it.data?.rot === "number" ? it.data.rot : 0;
    if (!rot) return { w: it.bounds.width, h: it.bounds.height, rot: 0, dpi: null };
    const flat = it.clone({ insert: false, deep: true });
    flat.rotate(rot, it.bounds.center);
    return { w: flat.bounds.width, h: flat.bounds.height, rot, dpi: null };
  }

  /** Effective DPI of a bitmap at its current printed size (null for anything else). */
  printDpi(it: Item): number | null {
    return it instanceof this.ps.Raster ? this.printMetrics(it).dpi : null;
  }

  /** The prints being adjusted (selected contents of the PowerClip being edited) and the frame's box. */
  private clipEditing(): { items: Item[]; frame: paper.Rectangle; box: paper.Rectangle; single: Item | null; w: number; h: number; rot: number; dpi: number | null } | null {
    const pc = this.clipEdit;
    const box = pc ? this.selectionBounds() : null;
    if (!pc || !box || !this.selected.length) return null;
    const single = this.selected.length === 1 ? this.selected[0] : null;
    const m = single ? this.printMetrics(single) : { w: box.width, h: box.height, rot: 0, dpi: null };
    return { items: this.selected, frame: frameOf(pc).bounds, box, single, ...m };
  }

  private clipContentState(): ClipContentState | null {
    const e = this.clipEditing();
    if (!e) return null;
    const a = anchorOf(rectOf(e.box), this.refPoint);
    const f = anchorOf(rectOf(e.frame), this.refPoint);
    const frameRatio = e.frame.width / e.frame.height;
    return {
      x: a.x - f.x,
      y: f.y - a.y,
      w: e.w,
      h: e.h,
      rotation: e.rot,
      multiple: !e.single,
      dpi: e.dpi,
      dpiLevel: e.dpi === null ? null : dpiLevel(e.dpi),
      stretchDistorts: Math.abs(e.w / e.h - frameRatio) > 0.005 * frameRatio || Math.abs(e.rot) > 1e-9,
    };
  }

  /** Remembers a rotation on vector prints (bitmaps keep it in their matrix). Stored in the range −180…180. */
  private trackRotation(items: Item[], degreesCcw: number) {
    if (!this.clipEdit || !degreesCcw) return;
    for (const it of items) if (!(it instanceof this.ps.Raster)) it.data.rot = ((((it.data?.rot ?? 0) + degreesCcw + 180) % 360) + 360) % 360 - 180;
  }

  /** Scales prints along their OWN width / height (a rotated print is not skewed), about a fixed point. */
  private scalePrints(items: Item[], sx: number, sy: number, about: paper.Point, rot: number) {
    for (const it of items) {
      if (rot) it.rotate(rot, about);
      it.scale(sx, sy, about);
      if (rot) it.rotate(-rot, about);
    }
  }

  /** Moves the selected prints so their anchor point sits at `target` (page inches). */
  private alignPrints(items: Item[], ref: number, target: { x: number; y: number }) {
    const b = this.selectionBounds();
    if (!b) return;
    const a = anchorOf(rectOf(b), ref);
    const d = new this.ps.Point(target.x - a.x, target.y - a.y);
    for (const it of items) it.translate(d);
  }

  /**
   * Exact values for the print inside the frame (property bar, edit mode).
   * x / y: the print's anchor relative to the frame's anchor (y up).
   * w / h: the print's own size. rotation: degrees counter-clockwise.
   */
  setClipContent(patch: { x?: number; y?: number; w?: number; h?: number; rotation?: number }) {
    const e = this.clipEditing();
    if (!e) return;
    const ps = this.ps;
    const anchor = anchorOf(rectOf(e.box), this.refPoint);
    if (patch.w !== undefined || patch.h !== undefined) {
      let sx = patch.w !== undefined && e.w > 0 ? patch.w / e.w : 1;
      let sy = patch.h !== undefined && e.h > 0 ? patch.h / e.h : 1;
      if (this.lockAspect) {
        if (patch.w !== undefined) sy = sx;
        else sx = sy;
      }
      if (Number.isFinite(sx) && Number.isFinite(sy) && sx > 0 && sy > 0) {
        this.scalePrints(e.items, sx, sy, new ps.Point(anchor), e.rot);
        this.alignPrints(e.items, this.refPoint, anchor); // the anchor point stays exactly where it was
      }
    }
    if (patch.rotation !== undefined && Number.isFinite(patch.rotation)) {
      const delta = patch.rotation - e.rot;
      const c = this.selectionBounds()!.center;
      for (const it of e.items) it.rotate(-delta, c);
      this.trackRotation(e.items, delta);
    }
    if (patch.x !== undefined || patch.y !== undefined) {
      const f = anchorOf(rectOf(e.frame), this.refPoint);
      const cur = anchorOf(rectOf(this.selectionBounds()!), this.refPoint);
      this.alignPrints(e.items, this.refPoint, { x: patch.x !== undefined ? f.x + patch.x : cur.x, y: patch.y !== undefined ? f.y - patch.y : cur.y });
    }
    this.commit();
  }

  /**
   * Quick fits, measured on the frame's bounding box:
   *   center  — middle of the print on the middle of the frame
   *   fit     — the whole print visible inside the frame
   *   fill    — the print covers the whole frame, no gaps
   *   stretch — exactly the frame's box (distorts the print; the UI asks first)
   *   top     — top-centre of the print on top-centre of the frame (waistband placement)
   * Fit and Fill then line up at the chosen anchor point. One undo step.
   */
  fitClipContent(mode: ClipFit) {
    const e = this.clipEditing();
    if (!e) return;
    const ps = this.ps;
    const F = rectOf(e.frame);
    const center = new ps.Point(e.box.center);
    if (mode === "fit" || mode === "fill") {
      const s = mode === "fit" ? fitScale(e.w, e.h, e.rot, F.w, F.h) : fillScale(e.w, e.h, e.rot, F.w, F.h);
      if (Number.isFinite(s) && s > 0) for (const it of e.items) it.scale(s, center);
      // A rotated print only covers the frame when it is centred on it.
      const ref = mode === "fill" && e.rot ? 4 : this.refPoint;
      this.alignPrints(e.items, ref, anchorOf(F, ref));
    } else if (mode === "stretch") {
      if (e.rot) {
        for (const it of e.items) it.rotate(e.rot, center);
        this.trackRotation(e.items, -e.rot);
      }
      const b = this.selectionBounds()!;
      if (b.width > 0 && b.height > 0) for (const it of e.items) it.scale(F.w / b.width, F.h / b.height, b.center);
      this.alignPrints(e.items, 4, anchorOf(F, 4));
    } else {
      const ref = mode === "top" ? 1 : 4;
      this.alignPrints(e.items, ref, anchorOf(F, ref));
    }
    this.commit();
  }

  // ---------------------------------------------------------------- PowerClip: repeat fill
  /**
   * Rebuilds the generated tiles of one repeat PowerClip: one tile definition
   * plus instances, only where the frame (plus bleed) is on screen. Nothing
   * here is saved — it all comes from the repeat settings.
   */
  private rebuildRepeat(pc: paper.Group) {
    const ps = this.ps;
    const clip = clipGroupOf(pc);
    for (const c of [...clip.children]) if (c.data?.pcRepeat) c.remove();
    const r = pc.data.pc.repeat as RepeatSettings | undefined;
    const holder = tileHolderOf(pc);
    const mask = clip.children.find((c) => c.data?.pcMask);
    if (!r || !holder || !mask || !holder.children.length) return;
    const tb = holder.bounds;
    if (!(tb.width > 0) || !(tb.height > 0)) return;
    const tile = rectOf(tb);
    // Only the part of the frame that is on screen (a little more, so panning does not show the edge).
    const view = this.ps.view.bounds;
    const visible = mask.bounds.intersect(view.expand(Math.max(view.width, view.height) * 0.1));
    const rep = new ps.Group({ insert: false });
    rep.data = { derived: true, pcRepeat: true };
    clip.insertChild(1, rep);
    this.repeatInfo.delete(pc);
    if (visible.width <= 0 || visible.height <= 0) return;
    const cover = coverInRepeatSpace(r, tile, rectOf(visible));
    const total = countCells(r, cover);
    if (total > MAX_TILES) {
      // Too small a tile for this zoom to draw one by one: show nothing rather than freeze; zooming in brings it back.
      this.repeatInfo.set(pc, { tiles: 0, skipped: total });
      return;
    }
    let def = this.tileDefs.get(holder);
    if (!def) {
      const art = new ps.Group({ insert: false });
      for (const c of holder.children) art.addChild(c.clone({ insert: false, deep: true }));
      def = new ps.SymbolDefinition(art, true);
      this.tileDefs.set(holder, def);
    }
    // Touching tiles get a half-screen-pixel overlap each side, which hides antialiasing hairlines between them.
    const { tw, th } = repeatSteps(r);
    const seamless = r.gapX <= 0 && r.gapY <= 0;
    const grow = seamless ? Math.min(1 / this.ps.view.zoom, tw / 50, th / 50) : 0;
    const cells = repeatCells(r, { x: tile.x, y: tile.y }, cover);
    const items: Item[] = [];
    for (const cell of cells) {
      const inst = new ps.SymbolItem(def);
      const m = cellMatrix(r, tile, cell, grow);
      inst.matrix = new ps.Matrix(m[0], m[1], m[2], m[3], m[4], m[5]);
      items.push(inst);
    }
    rep.addChildren(items);
    this.repeatInfo.set(pc, { tiles: items.length, skipped: 0 });
  }

  /** Rebuilds every repeat that needs it: all of them after a view or document change, or just the ones marked dirty. */
  private refreshRepeats(all: boolean) {
    const list = all ? this.clips().filter((pc) => pc.data.pc.repeat && pc.isInserted()) : [...this.dirtyRepeats].filter((pc) => pc.isInserted());
    this.dirtyRepeats.clear();
    for (const pc of list) this.rebuildRepeat(pc);
  }

  /**
   * After an object was rotated or scaled: repeat PowerClips inside it keep
   * their tile artwork upright and unscaled, and carry the change in the
   * repeat's own rotation / tile size instead — so the pattern turns and
   * grows with the piece, and stays parametric.
   */
  private fixRepeatsAfterTransform(it: Item, info: { rotate?: number; sx?: number; sy?: number }) {
    const pcs = isPowerClip(it) ? [it] : it instanceof this.ps.Group ? (it.getItems({ match: isPowerClip }) as paper.Group[]) : [];
    for (const pc of pcs) {
      const r = pc.data.pc.repeat as RepeatSettings | undefined;
      const holder = tileHolderOf(pc);
      if (!r || !holder) continue;
      const c = holder.bounds.center;
      const next = { ...r };
      if (info.rotate) {
        holder.rotate(info.rotate, c); // undo the turn on the artwork (it was turned counter-clockwise by info.rotate)
        next.rotation = r.rotation + info.rotate;
      }
      if (info.sx !== undefined) {
        const sx = info.sx;
        const sy = info.sy ?? info.sx;
        if (sx && sy) holder.scale(1 / sx, 1 / sy, c);
        next.tileW = r.tileW * Math.abs(sx);
        next.tileH = r.tileH * Math.abs(sy);
        next.gapX = r.gapX * Math.abs(sx);
        next.gapY = r.gapY * Math.abs(sy);
        next.offsetX = r.offsetX * Math.abs(sx);
        next.offsetY = r.offsetY * Math.abs(sy);
      }
      pc.data.pc = { ...pc.data.pc, repeat: next };
      this.tileDefs.delete(holder);
      this.dirtyRepeats.add(pc);
    }
  }

  /**
   * Repeat fill for the PowerClip being edited. `true` turns it on (one
   * tile = the current contents at their own size), `null` turns it off, a
   * patch changes settings. One undo step.
   */
  setClipRepeat(patch: Partial<RepeatSettings> | true | null) {
    const pc = this.currentClip();
    if (!pc) return;
    const cur = pc.data.pc.repeat as RepeatSettings | undefined;
    if (patch === null) {
      if (!cur) return;
      const { repeat: _off, ...rest } = pc.data.pc;
      void _off;
      pc.data.pc = rest;
      syncRepeatHolder(this.ps, pc);
      this.repeatInfo.delete(pc);
      if (pc === this.clipEdit) {
        // Back to a normal print: re-open it for editing so the single tile can be moved again.
        this.clipEdit = null;
        this.openClip(pc);
        this.selected = contentsOf(pc);
      }
    } else {
      let next: RepeatSettings;
      if (!cur) {
        const items = contentsOf(pc);
        if (!items.length) return;
        const b = items.map((i) => i.bounds).reduce((a, x) => a.unite(x));
        if (!(b.width > 0) || !(b.height > 0)) return;
        next = { ...defaultRepeat(b.width, b.height), ...(patch === true ? {} : patch) };
        if (pc === this.clipEdit) {
          // The single print stops being an object you drag; from now on dragging shifts the repeat.
          for (const c of [...pc.children]) if (c.data?.pcVeil) c.remove();
          this.selected = [];
        }
      } else next = { ...cur, ...(patch === true ? {} : patch) };
      for (const k of ["tileW", "tileH", "scale"] as const) if (!(next[k] > 0) || !Number.isFinite(next[k])) return;
      for (const k of ["gapX", "gapY", "offsetX", "offsetY", "rotation"] as const) if (!Number.isFinite(next[k])) return;
      pc.data.pc = { ...pc.data.pc, repeat: next };
      syncRepeatHolder(this.ps, pc);
      syncMask(this.ps, pc);
    }
    this.dirtyRepeats.add(pc);
    this.commit();
  }

  // ---------------------------------------------------------------- trace bitmap
  /** The single selected bitmap, for the Trace dialog. Null if the selection isn't exactly one bitmap. */
  async getTraceSource(): Promise<TraceSource | null> {
    const r = this.selected.length === 1 ? this.selected[0] : null;
    if (!(r instanceof this.ps.Raster)) return null;
    const asset = this.assets.get(r.data.assetId);
    if (!asset) return null;
    const image = await loadImageElement(asset.dataUrl);
    const o = r.matrix.transform(new this.ps.Point(0, 0));
    return {
      id: this.idOf(r),
      name: r.name || asset.name,
      image,
      widthIn: r.matrix.transform(new this.ps.Point(r.width, 0)).getDistance(o),
      heightIn: r.matrix.transform(new this.ps.Point(0, r.height)).getDistance(o),
    };
  }

  /**
   * Places a trace result as one group of vector shapes exactly over the
   * bitmap it came from (same size, position and rotation). One undo step.
   */
  placeTrace(rasterId: string, result: TraceResult, deleteOriginal: boolean): { ok: boolean; message: string } {
    const ps = this.ps;
    const r = this.contentLayer.children.find((c) => c.data.id === rasterId);
    if (!(r instanceof ps.Raster)) return { ok: false, message: "The original image is no longer on the page." };
    // Traced pixels → the raster's own space (centred on its middle) → page inches.
    const m = r.matrix;
    const at = (x: number, y: number) => m.transform(new ps.Point((x / result.width - 0.5) * r.width, (y / result.height - 0.5) * r.height));
    const group = new ps.Group({ insert: false });
    for (const shape of result.shapes) {
      const cp = new ps.CompoundPath({ insert: false });
      for (const sub of shape.subpaths) {
        cp.moveTo(at(sub.start[0], sub.start[1]));
        for (const s of sub.segs) {
          if (s[0] === "L") cp.lineTo(at(s[1], s[2]));
          else cp.quadraticCurveTo(at(s[1], s[2]), at(s[3], s[4]));
        }
        cp.closePath();
      }
      if (!cp.children.length) continue;
      // A shape without holes is a plain curve; one with holes stays a compound path.
      const item = cp.children.length === 1 ? cp.children[0] : cp;
      const [red, green, blue, alpha] = shape.color;
      item.fillColor = new ps.Color(red / 255, green / 255, blue / 255, alpha / 255);
      if (item === cp) cp.fillRule = "evenodd";
      group.addChild(item);
    }
    if (!group.children.length) return { ok: false, message: "Nothing was traced." };
    group.name = `Trace of ${r.name || "bitmap"}`;
    group.data.id = newId();
    group.insertAbove(r);
    if (deleteOriginal) r.remove();
    this.selected = [group];
    this.commit();
    return { ok: true, message: `Traced into ${group.children.length} shape${group.children.length === 1 ? "" : "s"} (${result.nodes} nodes)` };
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
  /** "+": a node at the middle of each selected segment. */
  addNodes() {
    this.shape.addNodes();
  }
  /** Delete / "-": removes the selected nodes, keeping the outline's shape as closely as possible. */
  deleteNodes() {
    this.shape.deleteNodes();
  }
  breakAtNodes() {
    this.shape.breakAtNodes();
  }
  /** Joins the two selected loose ends into one node. */
  joinNodes() {
    this.shape.joinEnds(false);
  }
  /** Extend curve to close: connects the loose ends with a straight line. */
  closeWithLine() {
    this.shape.joinEnds(true);
  }
  toggleClosed() {
    this.shape.toggleClosed();
  }
  reverseDirection() {
    this.shape.reverseDirection();
  }
  alignNodes(axis: "h" | "v") {
    this.shape.alignNodes(axis);
  }
  /** Reduce nodes: shows a preview at this tolerance (inches); nothing changes until applySimplify(). */
  previewSimplify(tolerance = DEFAULT_SIMPLIFY_TOLERANCE) {
    this.shape.previewSimplify(Math.max(1e-6, tolerance));
  }
  applySimplify() {
    this.shape.applySimplify();
  }
  cancelSimplify() {
    this.shape.cancelSimplify();
  }
  /** Check outlines: every open path in the document. */
  listOpenPaths(): OpenPathInfo[] {
    return this.shape.openPaths();
  }
  /** Jumps to an open path: Shape tool, loose ends selected, zoomed to fit. */
  editOpenPath(info: OpenPathInfo) {
    if (this.tool !== "shape") this.setTool("shape");
    const bounds = this.shape.enterOpenPath(info.address);
    if (bounds) this.fitRect(bounds.expand(Math.max(bounds.width, bounds.height) * 0.1 + 0.25));
    this.drawOverlay();
    this.emit();
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
    this.shapingDirty = true;
    this.selectedGuideId = null;
    this.rotateMode = false;
    this.drawGuides();
    this.drawOverlay();
    this.emit();
  }
  /** Objects panel click: a page object is selected; a PowerClip inside a group becomes the active one; a print opens its PowerClip for editing. */
  selectById(id: string, additive = false) {
    const it = this.findById(id);
    if (!it) return;
    if (insideClipContents(it)) {
      const pc = clipOwner(it);
      if (pc && pc !== this.clipEdit) this.editClip(pc);
      const top = this.topLevel(it);
      if (top) this.select([top], additive);
      return;
    }
    if (this.clipEdit) this.finishClipEdit();
    const root = this.rootOf(it);
    if (!root) return;
    this.activeClip = clipOwner(it);
    this.select([root], additive);
  }
  selectAll() {
    this.select(this.scope.children.filter((c) => c.visible && !c.locked && !isDerived(c)));
  }
  clearSelection() {
    this.select([]);
  }

  private hitTestContent(viewPoint: paper.Point): Item | null {
    const p = this.ps.view.viewToProject(viewPoint);
    const res = this.scope.hitTest(p, {
      fill: true,
      stroke: true,
      segments: false,
      tolerance: HIT_PX * this.px,
      match: (h: paper.HitResult) => {
        const top = this.topLevel(h.item);
        return !!top && top.visible && !top.locked && !isDerived(top) && !isDerived(h.item);
      },
    });
    return res ? this.topLevel(res.item) : null;
  }

  // ---------------------------------------------------------------- transforms
  translateSelection(dx: number, dy: number, record = true) {
    if (!this.selected.length) return;
    const d = new this.ps.Point(dx, dy);
    for (const it of this.selected) this.tf(it, (t) => t.translate(d));
    if (record) this.commit();
    else this.drawOverlay();
  }

  /** Nudge in display direction (dy positive = UP, like the rulers). */
  nudge(dxUnits: number, dyUp: number) {
    const r = this.clipEdit?.data.pc.repeat as RepeatSettings | undefined;
    if (r) {
      // Editing a repeat: the arrows shift where it starts.
      const d = deltaInRepeatSpace(r, dxUnits, -dyUp);
      return this.setClipRepeat({ offsetX: r.offsetX + d.x, offsetY: r.offsetY + d.y });
    }
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
      if (Number.isFinite(sx) && Number.isFinite(sy) && sx !== 0 && sy !== 0) for (const it of this.selected) this.tf(it, (t) => t.scale(sx, sy, anchor), { sx, sy });
    }
    if (patch.x !== undefined || patch.y !== undefined) {
      const nb = this.selectionBounds()!;
      const cur = this.refPointOf(nb, this.refPoint);
      const tx = patch.x !== undefined ? this.origin.x + patch.x : cur.x;
      const ty = patch.y !== undefined ? this.origin.y - patch.y : cur.y;
      for (const it of this.selected) this.tf(it, (t) => t.translate(new ps.Point(tx - cur.x, ty - cur.y)));
    }
    this.commit();
  }

  flip(axis: "h" | "v") {
    const b = this.selectionBounds();
    if (!b) return;
    for (const it of this.selected) this.tf(it, (t) => t.scale(axis === "h" ? -1 : 1, axis === "v" ? -1 : 1, b.center), { sx: axis === "h" ? -1 : 1, sy: axis === "v" ? -1 : 1 });
    // A mirror turns a remembered rotation the other way.
    if (this.clipEdit) for (const it of this.selected) if (typeof it.data?.rot === "number") it.data.rot = -it.data.rot;
    this.commit();
  }

  rotateSelection(degrees: number) {
    const b = this.selectionBounds();
    if (!b || !degrees) return;
    // Screen/ruler convention: positive = counter-clockwise (y up).
    for (const it of this.selected) this.tf(it, (t) => t.rotate(-degrees, b.center), { rotate: degrees });
    this.trackRotation(this.selected, degrees);
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
      this.scope.addChild(it);
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
      // A PowerClip is taken apart with Extract contents, not Ungroup.
      if (!(it instanceof this.ps.Group) || it.data?.pc) {
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
      this.tf(it, (t) => t.translate(new this.ps.Point(dx, dy)));
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
        this.tf(it, (t) => t.translate(new this.ps.Point(axis === "h" ? d : 0, axis === "v" ? d : 0)));
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
        this.tf(it, (t) => t.translate(new this.ps.Point(axis === "h" ? d : 0, axis === "v" ? d : 0)));
        pos += (axis === "h" ? b.width : b.height) + gap;
      }
    }
    this.commit();
  }

  setItemProps(id: string, patch: { name?: string; visible?: boolean; locked?: boolean }) {
    const it = this.findById(id);
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
    const t = new ps.PointText({ point: at, content, fontFamily: STUDIO_FONT, fontSize: fontSizeIn, insert: false });
    t.fillColor = new ps.Color("#000000");
    t.data.id = newId();
    this.scope.addChild(t);
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
    this.scope.addChild(r);
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
    const editingId = this.clipEdit?.data.id;
    const activeId = this.activeClip?.data.id;
    this.clipEdit = null;
    this.clipList = null;
    this.clipMenu = null;
    this.placing = null;
    this.contentLayer.removeChildren();
    for (const n of s.objects) {
      const it = fromNode(this.ps, n, (id) => this.assets.getProxy(id));
      if (it) this.contentLayer.addChild(it);
    }
    this.guides = s.guides;
    if (s.page.width !== this.page.width || s.page.height !== this.page.height) this.setPage(s.page, false);
    // The scene was rebuilt: find the PowerClip that was open (if it still exists) and stay inside it.
    const active = activeId ? this.findById(activeId) : null;
    this.activeClip = isPowerClip(active) ? active : null;
    const editing = editingId ? this.findById(editingId) : null;
    if (isPowerClip(editing)) this.openClip(editing);
    this.selected = this.scope.children.filter((c) => c.data.id && selectedIds.has(c.data.id));
    this.shapingDirty = true;
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
    this.clipEdit = null;
    this.activeClip = null;
    this.clipList = null;
    this.placing = null;
    this.clipMenu = null;
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
    this.clipEdit = null;
    this.activeClip = null;
    this.clipList = null;
    this.placing = null;
    this.clipMenu = null;
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
      e.preventDefault();
      if (e.button !== 0) return;
      // Pick tool: double-click a PowerClip to edit its contents.
      if (this.tool === "pick" && !this.clipEdit) {
        const pc = this.clipAt(this.ps.view.viewToProject(this.viewPoint(e)));
        if (pc) this.editClip(pc);
        return;
      }
      // Shape tool: double-click a node to delete it, the outline to add a node there.
      if (this.tool !== "shape") return;
      const vp = this.viewPoint(e);
      this.shape.doubleClick(vp, this.ps.view.viewToProject(vp));
      this.drawOverlay();
      this.emit();
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
    if (this.clipMenu) {
      this.clipMenu = null;
      this.emit();
    }
    // Corel: drag an object with the RIGHT mouse button onto an outline, then choose "PowerClip inside".
    if (e.button === 2 && this.tool === "pick" && !this.clipEdit) {
      const hit = this.hitTestContent(vp);
      if (hit) {
        if (!this.selected.includes(hit)) this.select([hit]);
        this.drag = { kind: "rdrag", startClient: new this.ps.Point(e.clientX, e.clientY), moved: false };
        this.canvas.style.cursor = "copy";
      }
      return;
    }
    if (e.button !== 0) return;
    if (this.placing) {
      // "Place inside frame": this click chooses the outline.
      const contents = this.placing;
      this.placing = null;
      this.canvas.style.cursor = this.toolCursor();
      this.onNotice?.(this.placeInside(contents, this.frameAt(p, contents)));
      this.emit();
      return;
    }
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

    // Editing a repeat fill: drag inside the frame to shift where the repeat starts; click outside to finish.
    if (this.tool === "pick" && this.clipEdit?.data.pc.repeat) {
      const r = this.clipEdit.data.pc.repeat as RepeatSettings;
      if (!(frameOf(this.clipEdit) as paper.Path).contains(p)) return void this.finishClipEdit();
      this.drag = { kind: "repeat", start: p, baseX: r.offsetX, baseY: r.offsetY, moved: false };
      this.canvas.style.cursor = "move";
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
      if (!this.clipEdit) this.activeClip = this.clipAt(p);
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
    // Editing a PowerClip's contents: a click on nothing finishes editing (like Corel's Finish button).
    if (this.clipEdit && !e.shiftKey) {
      this.finishClipEdit();
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
    if (this.placing || d?.kind === "rdrag") {
      const t = this.frameAt(p, this.placing ?? this.selected);
      const hover = t ? ("frame" in t ? t.frame : t.open) : null;
      if (hover !== this.frameHover) {
        this.frameHover = hover;
        this.drawOverlay();
      }
    }
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
        for (const it of this.selected) this.tf(it, (t) => t.translate(step));
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
        for (const it of this.selected) this.tf(it, (t) => t.scale(sx / d.sx, sy / d.sy, d.anchor), { sx: sx / d.sx, sy: sy / d.sy });
        d.sx = sx;
        d.sy = sy;
        break;
      }
      case "rotate": {
        let angle = p.subtract(d.center).angle - d.startAngle;
        if (e.ctrlKey || e.metaKey) angle = Math.round(angle / 15) * 15;
        const step = angle - d.applied;
        for (const it of this.selected) this.tf(it, (t) => t.rotate(step, d.center), { rotate: -step });
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
      case "rdrag":
        if (new ps.Point(e.clientX, e.clientY).getDistance(d.startClient) > 4) d.moved = true;
        return;
      case "repeat": {
        const pc = this.clipEdit;
        const r = pc?.data.pc.repeat as RepeatSettings | undefined;
        if (!pc || !r) break;
        const move = p.subtract(d.start);
        if (!d.moved && move.length / this.px < 3) return;
        d.moved = true;
        const off = deltaInRepeatSpace(r, move.x, move.y);
        pc.data.pc = { ...pc.data.pc, repeat: { ...r, offsetX: d.baseX + off.x, offsetY: d.baseY + off.y } };
        this.rebuildRepeat(pc); // live preview
        break;
      }
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
          // Ctrl+click a PowerClip → edit its contents (like Corel).
          const pc = e.ctrlKey || e.metaKey ? this.clipAt(this.ps.view.viewToProject(vp)) : null;
          if (pc && !this.clipEdit) this.editClip(pc);
          // Corel: click an already-selected object again → rotate handles.
          else this.rotateMode = !this.rotateMode;
        }
        break;
      case "rdrag": {
        this.canvas.style.cursor = this.toolCursor();
        if (!d.moved) break;
        const contents = [...this.selected];
        const target = this.frameAt(this.ps.view.viewToProject(vp), contents);
        if (target && "frame" in target) this.clipMenu = { x: e.clientX, y: e.clientY, frame: target.frame, contents };
        else this.onNotice?.(this.placeInside(contents, target));
        break;
      }
      case "rotate":
        // Handles turn clockwise-positive on screen; rotations are stored counter-clockwise.
        this.trackRotation(this.selected, -d.applied);
        this.commit();
        break;
      case "scale":
        this.commit();
        break;
      case "marquee": {
        const r = this.marqueeRect;
        this.marqueeRect = null;
        if (r && r.width * this.ps.view.zoom > 2 && r.height * this.ps.view.zoom > 2) {
          const hits = this.scope.children.filter((c) => c.visible && !c.locked && !isDerived(c) && (d.touching ? r.intersects(c.bounds) : r.contains(c.bounds)));
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
          this.scope.addChild(shape);
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
      case "repeat":
        this.canvas.style.cursor = this.toolCursor();
        if (d.moved) this.commit();
        break;
    }
    this.snapLabel = null;
    this.drawOverlay();
    this.emit();
  }
}
