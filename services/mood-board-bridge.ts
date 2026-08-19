"use server";

// Bridges a Mood Board into the REAL existing Catalog/Shop and
// Manufacturing architecture — mirrors createCatalogRowFromShopProductAction
// (services/shop.ts) and manufactureThisWishAction (services/wishes.ts)
// exactly. No second Shop, no duplicate manufacturing system: this only
// ever creates a real CatalogRow (or reuses the one already bridged from
// this board) and hands off to the existing, unmodified pages.

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { getOrCreateCatalogForOwner } from "@/lib/catalog-queries";
import { addRowAction } from "@/services/catalog";
import type { MoodBoardItemContent } from "@/types/mood-board";

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

async function requireOwnedBoardWithItems(boardId: string, ownerId: string) {
  const board = await db.moodBoard.findUnique({ where: { id: boardId }, include: { items: true } });
  if (!board || board.ownerId !== ownerId) return null;
  return board;
}

async function bridgeBoardToCatalogRow(boardId: string, ownerId: string) {
  const board = await requireOwnedBoardWithItems(boardId, ownerId);
  if (!board) return { success: false as const, error: "Board not found." };

  const catalog = await getOrCreateCatalogForOwner(ownerId);

  const existingRow = await db.catalogRow.findFirst({
    where: { catalogId: catalog.id, sourceMoodBoardId: boardId },
    select: { id: true },
  });
  if (existingRow) return { success: true as const, data: { rowId: existingRow.id } };

  const images: string[] = [];
  const materials = new Set<string>();
  const notesLines: string[] = [];
  for (const item of board.items) {
    const content = item.content as MoodBoardItemContent | null;
    if (!content) continue;
    if (content.kind === "image") images.push(content.src);
    if (content.kind === "material") materials.add(content.name);
    if (content.kind === "note") notesLines.push([content.title, ...content.bullets].filter(Boolean).join(" — "));
    if (content.kind === "annotation") notesLines.push(`${content.title}: ${content.description}`);
  }

  const sizeChart = Array.isArray(board.sizeChart) ? (board.sizeChart as { size: string }[]) : [];

  const created = await addRowAction({
    productName: board.name,
    description: notesLines.length ? notesLines.join(" | ") : undefined,
    color: board.palette[0] ?? undefined,
    sizes: sizeChart.map((r) => r.size).filter(Boolean),
    notes: materials.size ? `Materials: ${[...materials].join(", ")}` : undefined,
    status: "DRAFT",
  });
  if (!created.success) return { success: false as const, error: created.error };

  await db.catalogRow.update({ where: { id: created.data.id }, data: { sourceMoodBoardId: boardId } });

  if (images.length > 0) {
    await db.catalogRowImage.createMany({
      data: images.map((dataUrl, i) => ({ rowId: created.data.id, dataUrl, order: i, view: "OTHER" as const })),
    });
  }

  return { success: true as const, data: { rowId: created.data.id } };
}

export async function sendMoodBoardToShopAction(boardId: string): Promise<ActionResult<{ rowId: string }>> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const result = await bridgeBoardToCatalogRow(boardId, user.id);
  if (!result.success) return result;
  return { success: true, data: result.data };
}

export async function sendMoodBoardToManufacturerAction(boardId: string): Promise<ActionResult<{ rowId: string }>> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const result = await bridgeBoardToCatalogRow(boardId, user.id);
  if (!result.success) return result;
  return { success: true, data: result.data };
}

export interface SupplierOption {
  id: string;
  companyName: string;
  city: string;
  country: string;
}

/** Real SupplierListing search for the "Send DM" picker — reuses the same
 * real directory data findMatchingSuppliersAction (services/manufacturing.ts)
 * matches against, just by name instead of category. */
export async function searchSuppliersForDmAction(query: string): Promise<ActionResult<SupplierOption[]>> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const trimmed = query.trim();
  const listings = await db.supplierListing.findMany({
    where: trimmed ? { companyName: { contains: trimmed, mode: "insensitive" } } : {},
    orderBy: [{ verified: "desc" }, { rating: "desc" }],
    take: 8,
    select: { id: true, companyName: true, city: true, country: true },
  });
  return { success: true, data: listings };
}
