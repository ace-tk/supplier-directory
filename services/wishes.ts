"use server";

// "Add Your Wish" persistence. Mirrors services/design.ts's structure and
// ownership-check pattern — ProductWish/WishImage are the smallest
// additive models that could honestly represent "a buyer's saved product
// idea + reference images" (see prisma/schema.prisma). Image storage
// reuses the same dataUrl-on-a-row convention as CatalogRowImage/
// ProductDesignAttachment — no new upload pipeline.

import { db } from "@/lib/db";
import { validateImage, extractDataUrlMeta } from "@/lib/file-validation";
import { getUser } from "@/lib/session";
import { getOrCreateCatalogForOwner } from "@/lib/catalog-queries";
import { addRowAction } from "@/services/catalog";
import { saveWishDraftSchema } from "@/lib/validations/wishes";
import type { ProductWishRecord, ProductWishStatus } from "@/types/wishes";

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

const MAX_IMAGES = 6;

async function requireUser() {
  return getUser();
}

const wishInclude = {
  owner: { select: { name: true } },
  images: { orderBy: { order: "asc" as const } },
};

type WishWithRelations = Awaited<ReturnType<typeof fetchWishRaw>>;

function fetchWishRaw(id: string) {
  return db.productWish.findUnique({ where: { id }, include: wishInclude });
}

function mapWish(w: NonNullable<WishWithRelations>): ProductWishRecord {
  return {
    id: w.id,
    ownerId: w.ownerId,
    ownerName: w.owner.name,
    name: w.name,
    category: w.category,
    description: w.description,
    images: w.images.map((i) => ({ id: i.id, dataUrl: i.dataUrl, order: i.order })),
    targetQuantity: w.targetQuantity,
    targetMoq: w.targetMoq,
    targetPrice: w.targetPrice,
    currency: w.currency,
    material: w.material,
    colors: w.colors,
    sizes: w.sizes,
    targetLocation: w.targetLocation,
    requiredBy: w.requiredBy ? w.requiredBy.toISOString() : null,
    notes: w.notes,
    referenceUrl: w.referenceUrl,
    status: w.status,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

async function requireOwnedWish(id: string, ownerId: string) {
  const wish = await db.productWish.findUnique({ where: { id }, select: { ownerId: true, status: true } });
  if (!wish || wish.ownerId !== ownerId) return null;
  return wish;
}

export async function getMyWishesAction(): Promise<ActionResult<ProductWishRecord[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const rows = await db.productWish.findMany({
    where: { ownerId: user.id },
    include: wishInclude,
    orderBy: { updatedAt: "desc" },
  });
  return { success: true, data: rows.map(mapWish) };
}

export async function getWishAction(id: string): Promise<ActionResult<ProductWishRecord>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const wish = await fetchWishRaw(id);
  if (!wish || wish.ownerId !== user.id) return { success: false, error: "Wish not found." };
  return { success: true, data: mapWish(wish) };
}

/** Creates a new draft, or updates one the caller still owns AND that is
 * still DRAFT — submitted wishes are read-only for the buyer by design, so
 * this refuses to touch anything past DRAFT rather than silently allowing
 * edits to a submitted request. Image set is fully replaced each save
 * (the form manages the array client-side), capped at MAX_IMAGES and
 * validated with the same validateImage() used elsewhere in the app. */
export async function saveWishDraftAction(input: unknown): Promise<ActionResult<ProductWishRecord>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const parsed = saveWishDraftSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  if (data.images.length > MAX_IMAGES) {
    return { success: false, error: `You can upload up to ${MAX_IMAGES} images.` };
  }
  for (const img of data.images) {
    const { mimeType, sizeBytes } = extractDataUrlMeta(img.dataUrl);
    const v = validateImage(mimeType, sizeBytes);
    if (!v.valid) return { success: false, error: v.error! };
  }

  const baseData = {
    name: data.name,
    // Required, non-nullable columns — a brand-new/still-editing draft may
    // not have these filled in yet, so "" (not null) is the honest
    // "not provided yet" value; submitWishAction enforces they're real
    // before a wish can leave DRAFT.
    category: data.category ?? "",
    description: data.description ?? "",
    targetQuantity: data.targetQuantity ?? null,
    targetMoq: data.targetMoq ?? null,
    targetPrice: data.targetPrice ?? null,
    currency: data.currency,
    material: data.material || null,
    colors: data.colors,
    sizes: data.sizes,
    targetLocation: data.targetLocation || null,
    requiredBy: data.requiredBy ? new Date(data.requiredBy) : null,
    notes: data.notes || null,
    referenceUrl: data.referenceUrl || null,
  };

  if (data.id) {
    const existing = await requireOwnedWish(data.id, user.id);
    if (!existing) return { success: false, error: "Wish not found." };
    if (existing.status !== "DRAFT") return { success: false, error: "Submitted wishes can no longer be edited." };

    await db.$transaction([
      db.wishImage.deleteMany({ where: { wishId: data.id } }),
      db.productWish.update({
        where: { id: data.id },
        data: {
          ...baseData,
          images: { create: data.images.map((img, i) => ({ dataUrl: img.dataUrl, order: i })) },
        },
      }),
    ]);
    const updated = await fetchWishRaw(data.id);
    return { success: true, data: mapWish(updated!) };
  }

  const created = await db.productWish.create({
    data: {
      ...baseData,
      ownerId: user.id,
      images: { create: data.images.map((img, i) => ({ dataUrl: img.dataUrl, order: i })) },
    },
    include: wishInclude,
  });
  return { success: true, data: mapWish(created) };
}

/** Server-enforced: only the owner, only from DRAFT, and only once every
 * genuinely-required field (name/category/description/≥1 image) is
 * present — the same "draft vs. required-to-submit" split the form's `*`
 * fields imply. Idempotent against a stale double-click: re-submitting an
 * already-SUBMITTED wish just returns its current state instead of
 * erroring, so a duplicate click can never create a second record (there's
 * only ever one row) or throw a confusing error. */
export async function submitWishAction(id: string): Promise<ActionResult<ProductWishRecord>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const wish = await fetchWishRaw(id);
  if (!wish || wish.ownerId !== user.id) return { success: false, error: "Wish not found." };

  if (wish.status !== "DRAFT") {
    return { success: true, data: mapWish(wish) };
  }

  if (!wish.name.trim()) return { success: false, error: "Add a wish name before submitting." };
  if (!wish.category.trim()) return { success: false, error: "Select a category before submitting." };
  if (!wish.description.trim()) return { success: false, error: "Add a description before submitting." };
  if (wish.images.length === 0) return { success: false, error: "Add at least one reference image before submitting." };

  const submitted = await db.productWish.update({
    where: { id },
    data: { status: "SUBMITTED" },
    include: wishInclude,
  });
  return { success: true, data: mapWish(submitted) };
}

/** Drafts only — submitted wishes are read-only for the buyer (no delete,
 * no cancel) per the product decision for this MVP. */
export async function deleteWishDraftAction(id: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const wish = await requireOwnedWish(id, user.id);
  if (!wish) return { success: false, error: "Wish not found." };
  if (wish.status !== "DRAFT") return { success: false, error: "Only draft wishes can be deleted." };

  await db.productWish.delete({ where: { id } });
  return { success: true, data: undefined };
}

/**
 * Bridges a Wish into a real CatalogRow (ManufacturingRequest.productId is
 * a required FK to CatalogRow, so there's no way to attach a manufacturing
 * request directly to a Wish) — mirrors createCatalogRowFromShopProductAction
 * in services/shop.ts exactly. Idempotent per wish: repeated clicks reuse
 * the same seeded row instead of creating duplicates. Returns the rowId so
 * the caller can route straight into the existing, unmodified Manufacture
 * Your Own page.
 */
export async function manufactureThisWishAction(wishId: string): Promise<ActionResult<{ rowId: string }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const wish = await fetchWishRaw(wishId);
  if (!wish || wish.ownerId !== user.id) return { success: false, error: "Wish not found." };

  const catalog = await getOrCreateCatalogForOwner(user.id);

  const existingRow = await db.catalogRow.findFirst({
    where: { catalogId: catalog.id, sourceWishId: wishId },
    select: { id: true },
  });
  if (existingRow) return { success: true, data: { rowId: existingRow.id } };

  const created = await addRowAction({
    productName: wish.name,
    category: wish.category || undefined,
    description: wish.description || undefined,
    color: wish.colors[0] || undefined,
    sizes: wish.sizes,
    moq: wish.targetMoq ?? undefined,
    quantity: wish.targetQuantity ?? undefined,
    priceBeforeGst: wish.targetPrice ?? 0,
    currency: wish.currency,
    status: "DRAFT",
  });
  if (!created.success) return { success: false, error: created.error };

  await db.catalogRow.update({ where: { id: created.data.id }, data: { sourceWishId: wishId } });

  if (wish.images.length > 0) {
    await db.catalogRowImage.createMany({
      data: wish.images.map((img, i) => ({ rowId: created.data.id, dataUrl: img.dataUrl, order: i, view: "OTHER" as const })),
    });
  }

  return { success: true, data: { rowId: created.data.id } };
}

// ─── Admin ────────────────────────────────────────────────────────────

export async function getAllWishesAction(): Promise<ActionResult<ProductWishRecord[]>> {
  const user = await requireUser();
  if (!user || user.role !== "ADMIN") return { success: false, error: "Admins only." };

  const rows = await db.productWish.findMany({
    where: { status: { not: "DRAFT" } },
    include: wishInclude,
    orderBy: { updatedAt: "desc" },
  });
  return { success: true, data: rows.map(mapWish) };
}

const FORWARD_TRANSITIONS: Record<ProductWishStatus, ProductWishStatus[]> = {
  DRAFT: [],
  SUBMITTED: ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
};

export async function updateWishStatusAction(id: string, nextStatus: ProductWishStatus): Promise<ActionResult<ProductWishRecord>> {
  const user = await requireUser();
  if (!user || user.role !== "ADMIN") return { success: false, error: "Admins only." };

  const wish = await db.productWish.findUnique({ where: { id }, select: { status: true } });
  if (!wish) return { success: false, error: "Wish not found." };

  if (!FORWARD_TRANSITIONS[wish.status].includes(nextStatus)) {
    return { success: false, error: `Cannot move a wish from ${wish.status} to ${nextStatus}.` };
  }

  const updated = await db.productWish.update({ where: { id }, data: { status: nextStatus }, include: wishInclude });
  return { success: true, data: mapWish(updated) };
}
