"use server";

// AI Mood Board Studio — core persistence. Mirrors the ownership-check
// pattern used throughout services/design.ts, services/wishes.ts. Items
// are persisted granularly (one row per add/update/delete) rather than a
// monolithic "replace the whole board" save, so drag/resize-end only ever
// writes the one item that moved — no full-board rewrite, no risk of
// losing sibling items on a failed save.

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { validateImage, extractDataUrlMeta } from "@/lib/file-validation";
import type {
  MoodBoardRecord,
  MoodBoardSummary,
  MoodBoardItemRecord,
  MoodBoardCommentRecord,
  MoodBoardAssetRecord,
  MoodBoardItemContent,
  SizeChartRow,
} from "@/types/mood-board";
import type { MoodBoardItemType, MoodBoardAssetKind } from "@/lib/generated/prisma/enums";

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  return getUser();
}

function toContent(json: unknown): MoodBoardItemContent | null {
  if (!json || typeof json !== "object") return null;
  return json as MoodBoardItemContent;
}

function toSizeChart(json: unknown): SizeChartRow[] | null {
  if (!Array.isArray(json)) return null;
  return json as SizeChartRow[];
}

function mapItem(i: {
  id: string;
  boardId: string;
  type: MoodBoardItemType;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  content: unknown;
  createdAt: Date;
  updatedAt: Date;
}): MoodBoardItemRecord {
  return {
    id: i.id,
    boardId: i.boardId,
    type: i.type,
    positionX: i.positionX,
    positionY: i.positionY,
    width: i.width,
    height: i.height,
    rotation: i.rotation,
    zIndex: i.zIndex,
    content: toContent(i.content),
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  };
}

function mapComment(c: { id: string; boardId: string; authorId: string; content: string; createdAt: Date; author: { name: string } }): MoodBoardCommentRecord {
  return {
    id: c.id,
    boardId: c.boardId,
    authorId: c.authorId,
    authorName: c.author.name,
    content: c.content,
    createdAt: c.createdAt.toISOString(),
  };
}

const boardInclude = {
  items: { orderBy: { zIndex: "asc" as const } },
  comments: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" as const } },
};

type BoardWithRelations = Awaited<ReturnType<typeof fetchBoardRaw>>;

function fetchBoardRaw(id: string) {
  return db.moodBoard.findUnique({ where: { id }, include: boardInclude });
}

function mapBoard(b: NonNullable<BoardWithRelations>): MoodBoardRecord {
  return {
    id: b.id,
    ownerId: b.ownerId,
    name: b.name,
    palette: b.palette,
    sizeChart: toSizeChart(b.sizeChart),
    items: b.items.map(mapItem),
    comments: b.comments.map(mapComment),
    itemCount: b.items.length,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

async function requireOwnedBoard(boardId: string, ownerId: string) {
  const board = await db.moodBoard.findUnique({ where: { id: boardId }, select: { ownerId: true } });
  if (!board || board.ownerId !== ownerId) return null;
  return board;
}

export async function getMyBoardsAction(): Promise<ActionResult<MoodBoardSummary[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const boards = await db.moodBoard.findMany({
    where: { ownerId: user.id },
    include: { items: { where: { type: "IMAGE" }, orderBy: { zIndex: "asc" }, take: 1, select: { content: true } }, _count: { select: { items: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return {
    success: true,
    data: boards.map((b) => {
      const cover = toContent(b.items[0]?.content);
      return {
        id: b.id,
        name: b.name,
        itemCount: b._count.items,
        coverImage: cover?.kind === "image" ? cover.src : null,
        updatedAt: b.updatedAt.toISOString(),
      };
    }),
  };
}

export async function getBoardAction(id: string): Promise<ActionResult<MoodBoardRecord>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const board = await fetchBoardRaw(id);
  if (!board || board.ownerId !== user.id) return { success: false, error: "Board not found." };
  return { success: true, data: mapBoard(board) };
}

export async function createBoardAction(name?: string): Promise<ActionResult<MoodBoardRecord>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const created = await db.moodBoard.create({
    data: { ownerId: user.id, name: name?.trim() || "Untitled Board" },
    include: boardInclude,
  });
  return { success: true, data: mapBoard(created) };
}

export async function updateBoardMetaAction(
  boardId: string,
  input: { name?: string; palette?: string[]; sizeChart?: SizeChartRow[] }
): Promise<ActionResult<MoodBoardRecord>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const board = await requireOwnedBoard(boardId, user.id);
  if (!board) return { success: false, error: "Board not found." };

  await db.moodBoard.update({
    where: { id: boardId },
    data: {
      name: input.name !== undefined ? input.name.trim() || "Untitled Board" : undefined,
      palette: input.palette !== undefined ? input.palette : undefined,
      sizeChart: input.sizeChart !== undefined ? (input.sizeChart as unknown as object) : undefined,
    },
  });
  const updated = await fetchBoardRaw(boardId);
  return { success: true, data: mapBoard(updated!) };
}

export async function addItemAction(
  boardId: string,
  input: {
    type: MoodBoardItemType;
    positionX: number;
    positionY: number;
    width: number;
    height: number;
    content: MoodBoardItemContent;
  }
): Promise<ActionResult<MoodBoardItemRecord>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const board = await requireOwnedBoard(boardId, user.id);
  if (!board) return { success: false, error: "Board not found." };

  const maxZ = await db.moodBoardItem.aggregate({ where: { boardId }, _max: { zIndex: true } });

  const created = await db.moodBoardItem.create({
    data: {
      boardId,
      type: input.type,
      positionX: input.positionX,
      positionY: input.positionY,
      width: input.width,
      height: input.height,
      zIndex: (maxZ._max.zIndex ?? -1) + 1,
      content: input.content,
    },
  });
  return { success: true, data: mapItem(created) };
}

async function requireOwnedItem(itemId: string, ownerId: string) {
  const item = await db.moodBoardItem.findUnique({ where: { id: itemId }, include: { board: { select: { ownerId: true } } } });
  if (!item || item.board.ownerId !== ownerId) return null;
  return item;
}

export async function updateItemAction(
  itemId: string,
  input: Partial<{
    positionX: number;
    positionY: number;
    width: number;
    height: number;
    rotation: number;
    zIndex: number;
    content: MoodBoardItemContent;
  }>
): Promise<ActionResult<MoodBoardItemRecord>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const item = await requireOwnedItem(itemId, user.id);
  if (!item) return { success: false, error: "Item not found." };

  const updated = await db.moodBoardItem.update({ where: { id: itemId }, data: input });
  return { success: true, data: mapItem(updated) };
}

export async function bringItemToFrontAction(itemId: string): Promise<ActionResult<MoodBoardItemRecord>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const item = await requireOwnedItem(itemId, user.id);
  if (!item) return { success: false, error: "Item not found." };

  const maxZ = await db.moodBoardItem.aggregate({ where: { boardId: item.boardId }, _max: { zIndex: true } });
  const updated = await db.moodBoardItem.update({ where: { id: itemId }, data: { zIndex: (maxZ._max.zIndex ?? 0) + 1 } });
  return { success: true, data: mapItem(updated) };
}

export async function deleteItemAction(itemId: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const item = await requireOwnedItem(itemId, user.id);
  if (!item) return { success: false, error: "Item not found." };

  await db.moodBoardItem.delete({ where: { id: itemId } });
  return { success: true, data: undefined };
}

export async function addCommentAction(boardId: string, content: string): Promise<ActionResult<MoodBoardCommentRecord>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const board = await requireOwnedBoard(boardId, user.id);
  if (!board) return { success: false, error: "Board not found." };
  if (!content.trim()) return { success: false, error: "Comment can't be empty." };

  const created = await db.moodBoardComment.create({
    data: { boardId, authorId: user.id, content: content.trim() },
    include: { author: { select: { name: true } } },
  });
  return { success: true, data: mapComment(created) };
}

// ─── Assets (Uploads / Prints / Embroidery / Reference) ─────────────────
// Real, per-user, DB-backed — no fabricated stock gallery exists anywhere
// in this app, so these panels are honestly powered by what the user has
// actually uploaded, reusing the exact same validateImage/dataUrl pipeline
// as every other upload surface in the app.

export async function uploadAssetAction(input: {
  kind: MoodBoardAssetKind;
  fileName: string;
  dataUrl: string;
}): Promise<ActionResult<MoodBoardAssetRecord>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const { mimeType, sizeBytes } = extractDataUrlMeta(input.dataUrl);
  const v = validateImage(mimeType, sizeBytes, input.fileName);
  if (!v.valid) return { success: false, error: v.error! };

  const created = await db.moodBoardAsset.create({
    data: { ownerId: user.id, kind: input.kind, fileName: input.fileName, mimeType, sizeBytes, dataUrl: input.dataUrl },
  });
  return {
    success: true,
    data: { id: created.id, kind: created.kind, fileName: created.fileName, mimeType: created.mimeType, sizeBytes: created.sizeBytes, dataUrl: created.dataUrl, createdAt: created.createdAt.toISOString() },
  };
}

export async function getMyAssetsAction(kind?: MoodBoardAssetKind): Promise<ActionResult<MoodBoardAssetRecord[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const rows = await db.moodBoardAsset.findMany({
    where: { ownerId: user.id, ...(kind ? { kind } : {}) },
    orderBy: { createdAt: "desc" },
  });
  return { success: true, data: rows.map((a) => ({ id: a.id, kind: a.kind, fileName: a.fileName, mimeType: a.mimeType, sizeBytes: a.sizeBytes, dataUrl: a.dataUrl, createdAt: a.createdAt.toISOString() })) };
}

export async function deleteAssetAction(assetId: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const asset = await db.moodBoardAsset.findUnique({ where: { id: assetId }, select: { ownerId: true } });
  if (!asset || asset.ownerId !== user.id) return { success: false, error: "Asset not found." };

  await db.moodBoardAsset.delete({ where: { id: assetId } });
  return { success: true, data: undefined };
}

/** Real material names already in use across the Shop's Product catalog —
 * the honest "Fabric library" per the audit's finding that no dedicated
 * fabric/swatch-image model exists anywhere in this app. Never fabricated
 * fabric photography. */
export async function getRealMaterialOptionsAction(): Promise<ActionResult<string[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const rows = await db.product.findMany({
    where: { material: { not: null } },
    select: { material: true },
    distinct: ["material"],
    take: 24,
  });
  return { success: true, data: rows.map((r) => r.material!).filter(Boolean).sort() };
}
