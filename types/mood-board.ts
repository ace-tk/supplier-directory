import type { MoodBoardItemType, MoodBoardAssetKind } from "@/lib/generated/prisma/enums";

export type { MoodBoardItemType, MoodBoardAssetKind };

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
