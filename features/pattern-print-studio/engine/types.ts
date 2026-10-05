import type { DisplayUnit } from "./units";

export type Orientation = "h" | "v";

/** A guideline. `pos` is in inches, in project space (y grows DOWN): a
 * horizontal guide stores its y, a vertical guide its x. */
export interface Guide {
  id: string;
  orientation: Orientation;
  pos: number;
}

export interface SnapSettings {
  grid: boolean;
  guides: boolean;
  objects: boolean;
  page: boolean;
}

export interface GridSettings {
  visible: boolean;
  /** Major grid spacing, inches. */
  spacing: number;
  /** Minor lines per major cell (snapping uses the minor spacing). */
  subdivisions: number;
}

export interface DocSettings {
  units: DisplayUnit;
  /** Arrow-key nudge, inches (Shift = ×10). */
  nudge: number;
  /** Ctrl+D duplicate offset, inches (x right, y UP — Corel convention). */
  duplicateOffset: { x: number; y: number };
  grid: GridSettings;
  snap: SnapSettings;
  guidesVisible: boolean;
  /** PowerClip cut lines: each frame's outline drawn on top of its print (a view aid, not part of the artwork). */
  cutLines: CutLineSettings;
}

export interface CutLineSettings {
  visible: boolean;
  color: string;
  /** Inches. */
  width: number;
}

export interface PageSize {
  /** Inches. */
  width: number;
  height: number;
}

/** Ruler origin in project space (inches, y down). Default: page bottom-left. */
export interface Origin {
  x: number;
  y: number;
}

/** An imported raster: the ORIGINAL file is kept for export; the canvas only
 * ever shows a downscaled proxy built from it. */
export interface RasterAsset {
  id: string;
  name: string;
  mime: string;
  /** Original file, as a data URL (kept for later full-resolution export). */
  dataUrl: string;
  pxWidth: number;
  pxHeight: number;
  dpi: number;
}

export type ToolId = "pick" | "shape" | "rectangle" | "ellipse" | "text" | "zoom" | "pan";

export const DEFAULT_SETTINGS: DocSettings = {
  units: "in",
  nudge: 0.01,
  duplicateOffset: { x: 0.25, y: 0.25 },
  grid: { visible: false, spacing: 1, subdivisions: 4 },
  snap: { grid: false, guides: true, objects: true, page: true },
  guidesVisible: true,
  // 0.5 pt black, like CorelDRAW's hairline outline.
  cutLines: { visible: true, color: "#000000", width: 0.5 / 72 },
};

/** Leggings program page (CorelDRAW): 163.75 × 37.694 in. */
export const DEFAULT_PAGE: PageSize = { width: 163.75, height: 37.694 };
