// Real, DB-backed read layer for Catalog Management — one catalog per user,
// auto-created on first visit, shared identical experience across all four
// portals.

import { db } from "@/lib/db";
import type { CatalogRecord, CatalogRowRecord } from "@/types/catalog";

const catalogInclude = {
  rows: {
    orderBy: { order: "asc" as const },
    include: {
      images: { orderBy: { order: "asc" as const } },
      attachments: { orderBy: { createdAt: "asc" as const } },
    },
  },
};

type CatalogWithRows = NonNullable<Awaited<ReturnType<typeof fetchCatalogRaw>>>;

function fetchCatalogRaw(ownerId: string) {
  return db.catalog.findUnique({ where: { ownerId }, include: catalogInclude });
}

export function mapRow(r: CatalogWithRows["rows"][number]): CatalogRowRecord {
  return {
    id: r.id,
    catalogId: r.catalogId,
    category: r.category,
    productName: r.productName,
    brandName: r.brandName,
    sku: r.sku,
    description: r.description,
    quantity: r.quantity,
    sizes: r.sizes,
    color: r.color,
    moq: r.moq,
    hsnCode: r.hsnCode,
    gstPercent: r.gstPercent,
    priceBeforeGst: r.priceBeforeGst,
    priceAfterGst: r.priceAfterGst,
    currency: r.currency,
    shippingCost: r.shippingCost,
    miscCost: r.miscCost,
    leadTime: r.leadTime,
    status: r.status,
    notes: r.notes,
    order: r.order,
    images: r.images.map((i) => ({ id: i.id, dataUrl: i.dataUrl, order: i.order })),
    attachments: r.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      dataUrl: a.dataUrl,
    })),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function mapCatalog(c: CatalogWithRows): CatalogRecord {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    rows: c.rows.map(mapRow),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

/** Idempotent — creates the user's catalog on first access, then always returns it. */
export async function getOrCreateCatalogForOwner(ownerId: string): Promise<CatalogRecord> {
  const existing = await fetchCatalogRaw(ownerId);
  if (existing) return mapCatalog(existing);

  await db.catalog.create({ data: { ownerId } });
  const created = await fetchCatalogRaw(ownerId);
  return mapCatalog(created!);
}
