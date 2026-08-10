"use server";

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { validateImage, validateDocument } from "@/lib/file-validation";
import { catalogRowInputSchema, type CatalogRowInput } from "@/lib/validations/catalog";
import { getOrCreateCatalogForOwner, mapRow } from "@/lib/catalog-queries";
import { computeCatalogPriceAfterGst } from "@/lib/catalog-ui";
import type { CatalogRecord, CatalogRowRecord } from "@/types/catalog";

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const user = await getUser();
  return user ?? null;
}

async function requireOwnedRow(rowId: string, ownerId: string) {
  const row = await db.catalogRow.findUnique({ where: { id: rowId }, include: { catalog: { select: { ownerId: true } } } });
  if (!row || row.catalog.ownerId !== ownerId) return null;
  return row;
}

export async function getCatalogAction(): Promise<ActionResult<CatalogRecord>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  return { success: true, data: await getOrCreateCatalogForOwner(user.id) };
}

export async function addRowAction(input?: Partial<CatalogRowInput>): Promise<ActionResult<CatalogRowRecord>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const catalog = await getOrCreateCatalogForOwner(user.id);
  const parsed = catalogRowInputSchema.safeParse(input ?? {});
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const maxOrder = await db.catalogRow.aggregate({ where: { catalogId: catalog.id }, _max: { order: true } });
  const row = await db.catalogRow.create({
    data: {
      ...parsed.data,
      priceAfterGst: computeCatalogPriceAfterGst(parsed.data.priceBeforeGst, parsed.data.gstPercent),
      catalogId: catalog.id,
      order: (maxOrder._max.order ?? -1) + 1,
    },
    include: { images: true, attachments: true },
  });

  return { success: true, data: mapRow(row) };
}

export async function updateRowFieldAction(
  rowId: string,
  field: keyof CatalogRowInput,
  value: unknown
): Promise<ActionResult<void>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const row = await requireOwnedRow(rowId, user.id);
  if (!row) return { success: false, error: "Row not found." };

  const partialSchema = catalogRowInputSchema.partial();
  const parsed = partialSchema.safeParse({ [field]: value });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  // priceAfterGst is always server-derived — never trust a directly
  // submitted value; recompute whenever either of its inputs changes.
  const data: Record<string, unknown> = { ...parsed.data };
  delete data.priceAfterGst;
  if (field === "priceBeforeGst" || field === "gstPercent") {
    const priceBeforeGst = field === "priceBeforeGst" ? (parsed.data.priceBeforeGst as number) : row.priceBeforeGst;
    const gstPercent = field === "gstPercent" ? (parsed.data.gstPercent as number) : row.gstPercent;
    data.priceAfterGst = computeCatalogPriceAfterGst(priceBeforeGst, gstPercent);
  }

  await db.catalogRow.update({ where: { id: rowId }, data });
  return { success: true, data: undefined };
}

/** Bulk multi-field update, used by the page-based Add/Edit form (vs. updateRowFieldAction's single-cell autosave used by the inline table). */
export async function updateRowAction(
  rowId: string,
  input: Partial<CatalogRowInput>
): Promise<ActionResult<CatalogRowRecord>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const row = await requireOwnedRow(rowId, user.id);
  if (!row) return { success: false, error: "Row not found." };

  const parsed = catalogRowInputSchema.partial().safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const data: Record<string, unknown> = { ...parsed.data };
  delete data.priceAfterGst;
  if (parsed.data.priceBeforeGst !== undefined || parsed.data.gstPercent !== undefined) {
    const priceBeforeGst = parsed.data.priceBeforeGst ?? row.priceBeforeGst;
    const gstPercent = parsed.data.gstPercent ?? row.gstPercent;
    data.priceAfterGst = computeCatalogPriceAfterGst(priceBeforeGst, gstPercent);
  }

  const updated = await db.catalogRow.update({
    where: { id: rowId },
    data,
    include: { images: true, attachments: true },
  });
  return { success: true, data: mapRow(updated) };
}

export async function deleteRowAction(rowId: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const row = await requireOwnedRow(rowId, user.id);
  if (!row) return { success: false, error: "Row not found." };

  await db.catalogRow.delete({ where: { id: rowId } });
  return { success: true, data: undefined };
}

export async function duplicateRowAction(rowId: string): Promise<ActionResult<CatalogRowRecord>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const row = await requireOwnedRow(rowId, user.id);
  if (!row) return { success: false, error: "Row not found." };

  const maxOrder = await db.catalogRow.aggregate({ where: { catalogId: row.catalogId }, _max: { order: true } });
  const copy = await db.catalogRow.create({
    data: {
      catalogId: row.catalogId,
      category: row.category,
      productName: `${row.productName} (Copy)`,
      brandName: row.brandName,
      sku: row.sku,
      description: row.description,
      quantity: row.quantity,
      sizes: row.sizes,
      color: row.color,
      moq: row.moq,
      hsnCode: row.hsnCode,
      gstPercent: row.gstPercent,
      priceBeforeGst: row.priceBeforeGst,
      priceAfterGst: row.priceAfterGst,
      currency: row.currency,
      shippingCost: row.shippingCost,
      miscCost: row.miscCost,
      leadTime: row.leadTime,
      status: row.status,
      notes: row.notes,
      order: (maxOrder._max.order ?? -1) + 1,
    },
    include: { images: true, attachments: true },
  });

  return { success: true, data: mapRow(copy) };
}

export async function reorderRowsAction(rowIds: string[]): Promise<ActionResult<void>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const catalog = await getOrCreateCatalogForOwner(user.id);
  const ownedIds = new Set(catalog.rows.map((r) => r.id));
  if (!rowIds.every((id) => ownedIds.has(id))) return { success: false, error: "Row not found." };

  await db.$transaction(rowIds.map((id, index) => db.catalogRow.update({ where: { id }, data: { order: index } })));
  return { success: true, data: undefined };
}

export async function addRowImageAction(
  rowId: string,
  input: { dataUrl: string; mimeType: string; sizeBytes: number }
): Promise<ActionResult<{ id: string; dataUrl: string; order: number }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const row = await requireOwnedRow(rowId, user.id);
  if (!row) return { success: false, error: "Row not found." };

  const v = validateImage(input.mimeType, input.sizeBytes);
  if (!v.valid) return { success: false, error: v.error! };

  const count = await db.catalogRowImage.count({ where: { rowId } });
  const image = await db.catalogRowImage.create({ data: { rowId, dataUrl: input.dataUrl, order: count } });
  return { success: true, data: { id: image.id, dataUrl: image.dataUrl, order: image.order } };
}

export async function removeRowImageAction(imageId: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const image = await db.catalogRowImage.findUnique({
    where: { id: imageId },
    include: { row: { include: { catalog: { select: { ownerId: true } } } } },
  });
  if (!image || image.row.catalog.ownerId !== user.id) return { success: false, error: "Image not found." };

  await db.catalogRowImage.delete({ where: { id: imageId } });
  return { success: true, data: undefined };
}

export async function addRowAttachmentAction(
  rowId: string,
  input: { fileName: string; mimeType: string; sizeBytes: number; dataUrl: string }
): Promise<ActionResult<{ id: string; fileName: string; mimeType: string; sizeBytes: number; dataUrl: string }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const row = await requireOwnedRow(rowId, user.id);
  if (!row) return { success: false, error: "Row not found." };

  const v = validateDocument(input.mimeType, input.sizeBytes);
  if (!v.valid) return { success: false, error: v.error! };

  const attachment = await db.catalogRowAttachment.create({ data: { rowId, ...input } });
  return {
    success: true,
    data: {
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      dataUrl: attachment.dataUrl,
    },
  };
}

export async function removeRowAttachmentAction(attachmentId: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const attachment = await db.catalogRowAttachment.findUnique({
    where: { id: attachmentId },
    include: { row: { include: { catalog: { select: { ownerId: true } } } } },
  });
  if (!attachment || attachment.row.catalog.ownerId !== user.id) return { success: false, error: "Attachment not found." };

  await db.catalogRowAttachment.delete({ where: { id: attachmentId } });
  return { success: true, data: undefined };
}

export async function importRowsAction(rows: Partial<CatalogRowInput>[]): Promise<ActionResult<{ count: number }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  if (rows.length === 0) return { success: false, error: "No rows to import." };
  if (rows.length > 500) return { success: false, error: "Import is limited to 500 rows at a time." };

  const catalog = await getOrCreateCatalogForOwner(user.id);
  const maxOrder = await db.catalogRow.aggregate({ where: { catalogId: catalog.id }, _max: { order: true } });
  let cursor = (maxOrder._max.order ?? -1) + 1;

  const validRows = rows
    .map((r) => catalogRowInputSchema.safeParse(r))
    .filter((r): r is { success: true; data: CatalogRowInput } => r.success)
    .map((r) => ({ ...r.data, catalogId: catalog.id, order: cursor++ }));

  if (validRows.length === 0) return { success: false, error: "No valid rows found in the file." };

  await db.catalogRow.createMany({ data: validRows });
  return { success: true, data: { count: validRows.length } };
}
