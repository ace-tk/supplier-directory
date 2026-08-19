import type { MoodBoardItemType, MoodBoardAssetKind } from "@/lib/generated/prisma/enums";

export type { MoodBoardItemType, MoodBoardAssetKind };

/**
 * The one shared MoodBoardStudio component is rendered from both the
 * Buyer and Admin portals — everything about its UI stays identical, only
 * where its business-workflow buttons navigate differs per role/portal,
 * since each portal has its own route prefix (and Admin currently has no
 * real Manufacture Your Own workflow at all — see `manufacture: null`).
 */
export interface MoodBoardBasePaths {
  /** e.g. "/buyer/mood-board" or "/mood-board" — this board's own module root. */
  moodBoard: string;
  /** e.g. "/buyer/catalog" or "/catalog" — Send to Shop Page target (real Catalog editor). */
  catalogEdit: string;
  /** e.g. "/buyer/product" or null if this role has no real Manufacture Your Own route. */
  manufacture: string | null;
  /** e.g. "/buyer/messages" or "/crm" — real CRM conversation route for this role. */
  messages: string;
  /** Where "Close" leaves the workspace to, e.g. "/buyer" or "/dashboard". */
  close: string;
}

/** Every canvas object shares position/size/rotation/layer — `content`'s
 * shape depends on `type`, interpreted client-side (CanvasItem.tsx). Kept
 * as one flexible item model rather than five near-identical tables. */
export type MoodBoardItemContent =
  | { kind: "image"; src: string }
  | { kind: "text"; text: string; fontSize?: number; color?: string }
  | { kind: "note"; title?: string; bullets: string[] }
  | { kind: "annotation"; title: string; description: string }
  | { kind: "material"; name: string }
  | { kind: "swatch"; hex: string; name?: string };

export interface MoodBoardItemRecord {
  id: string;
  boardId: string;
  type: MoodBoardItemType;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  content: MoodBoardItemContent | null;
  createdAt: string;
  updatedAt: string;
}

export interface MoodBoardCommentRecord {
  id: string;
  boardId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface MoodBoardRecord {
  id: string;
  ownerId: string;
  name: string;
  palette: string[];
  sizeChart: SizeChartRow[] | null;
  items: MoodBoardItemRecord[];
  comments: MoodBoardCommentRecord[];
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MoodBoardSummary {
  id: string;
  name: string;
  itemCount: number;
  coverImage: string | null;
  updatedAt: string;
}

export interface SizeChartRow {
  size: string;
  bust: string;
  waist: string;
  hip: string;
}

export interface MoodBoardAssetRecord {
  id: string;
  kind: MoodBoardAssetKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  createdAt: string;
}
