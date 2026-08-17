"use server";

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { getOrCreateCatalogForOwner } from "@/lib/catalog-queries";
import { addRowAction } from "@/services/catalog";
import { getMoqNumber, getPriceMin } from "@/lib/product-tags";

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  return getUser();
}

/** Ids of Shop products the current user has saved — empty (not an error)
 * when signed out, since the Shop card renders Save regardless of auth
 * state and only gates the click itself. */
export async function getMySavedProductIdsAction(): Promise<ActionResult<string[]>> {
  const user = await requireUser();
  if (!user) return { success: true, data: [] };

  const rows = await db.savedProduct.findMany({ where: { userId: user.id }, select: { productId: true } });
  return { success: true, data: rows.map((r) => r.productId) };
}

/** Toggles a real, persisted save — and keeps Product.savedCount (the same
 * counter Best Seller/Trending tags read) in sync in the same transaction,
 * so the two can never drift apart. */
export async function toggleSavedProductAction(productId: string): Promise<ActionResult<{ saved: boolean; savedCount: number }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const existing = await db.savedProduct.findUnique({
    where: { userId_productId: { userId: user.id, productId } },
    select: { id: true },
  });

  const [, product] = await db.$transaction([
    existing
      ? db.savedProduct.delete({ where: { id: existing.id } })
      : db.savedProduct.create({ data: { userId: user.id, productId } }),
    db.product.update({
      where: { id: productId },
      data: { savedCount: { [existing ? "decrement" : "increment"]: 1 } },
      select: { savedCount: true },
    }),
  ]);

  return { success: true, data: { saved: !existing, savedCount: product.savedCount } };
}

/**
 * Bridges a Shop marketplace Product into the buyer's own Catalog so the
 * already-existing Design Your Own / Manufacture Your Own pages (which
 * only accept a CatalogRow the current user owns) can be reused unmodified.
 * Idempotent: repeated clicks on the same Shop product reuse the same
 * seeded row rather than creating duplicates.
 */
export async function createCatalogRowFromShopProductAction(productId: string): Promise<ActionResult<{ rowId: string }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) return { success: false, error: "Product not found." };

  const catalog = await getOrCreateCatalogForOwner(user.id);

  const existingRow = await db.catalogRow.findFirst({
    where: { catalogId: catalog.id, sourceShopProductId: productId },
    select: { id: true },
  });
  if (existingRow) return { success: true, data: { rowId: existingRow.id } };

  const created = await addRowAction({
    productName: product.name,
    category: product.category ?? undefined,
    description: product.description ?? undefined,
    leadTime: product.leadTime ?? undefined,
    moq: getMoqNumber(product) ?? undefined,
    priceBeforeGst: getPriceMin(product),
    currency: "INR",
    status: "DRAFT",
  });
  if (!created.success) return { success: false, error: created.error };

  await db.catalogRow.update({ where: { id: created.data.id }, data: { sourceShopProductId: productId } });

  if (product.images.length > 0) {
    await db.catalogRowImage.createMany({
      data: product.images.map((url, i) => ({ rowId: created.data.id, dataUrl: url, order: i, view: "OTHER" as const })),
    });
  }

  return { success: true, data: { rowId: created.data.id } };
}
