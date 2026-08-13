"use server";

// "Design Your Own" persistence — a small additive model (see
// prisma/schema.prisma's ProductDesign) since no existing model could
// honestly represent a saved customization spec. Mirrors services/
// catalog.ts's ownership-check pattern (requireOwnedRow) throughout.

import { db } from "@/lib/db";
import { validateDocument } from "@/lib/file-validation";
import { getUser } from "@/lib/session";
import { saveDesignSchema } from "@/lib/validations/design";
import type { DesignSpecification, ProductDesignRecord, DesignAttachmentEntry } from "@/types/design";

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const user = await getUser();
  return user ?? null;
}

function toSpecification(json: unknown): DesignSpecification {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  return json as DesignSpecification;
}

const designInclude = {
  product: { select: { productName: true } },
  attachments: { orderBy: { createdAt: "asc" as const } },
};

type DesignWithRelations = Awaited<ReturnType<typeof fetchDesignRaw>>;

function fetchDesignRaw(id: string) {
  return db.productDesign.findUnique({ where: { id }, include: designInclude });
}

function mapDesign(d: NonNullable<DesignWithRelations>): ProductDesignRecord {
  return {
    id: d.id,
    productId: d.productId,
    productName: d.product.productName,
    ownerId: d.ownerId,
    name: d.name,
    specification: toSpecification(d.specification),
    notes: d.notes,
    attachments: d.attachments.map(mapAttachment),
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

function mapAttachment(a: { id: string; fileName: string; mimeType: string; sizeBytes: number; dataUrl: string }): DesignAttachmentEntry {
  return { id: a.id, fileName: a.fileName, mimeType: a.mimeType, sizeBytes: a.sizeBytes, dataUrl: a.dataUrl };
}

async function requireOwnedProduct(productId: string, ownerId: string) {
  const row = await db.catalogRow.findUnique({ where: { id: productId }, include: { catalog: { select: { ownerId: true } } } });
  if (!row || row.catalog.ownerId !== ownerId) return null;
  return row;
}

async function requireOwnedDesign(id: string, ownerId: string) {
  const design = await db.productDesign.findUnique({ where: { id }, select: { ownerId: true } });
  if (!design || design.ownerId !== ownerId) return null;
  return design;
}

export async function listDesignsForProductAction(productId: string): Promise<ActionResult<ProductDesignRecord[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const product = await requireOwnedProduct(productId, user.id);
  if (!product) return { success: false, error: "Product not found." };

  const rows = await db.productDesign.findMany({
    where: { productId, ownerId: user.id },
    include: designInclude,
    orderBy: { updatedAt: "desc" },
  });
  return { success: true, data: rows.map(mapDesign) };
}

export async function getDesignAction(id: string): Promise<ActionResult<ProductDesignRecord>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const design = await fetchDesignRaw(id);
  if (!design || design.ownerId !== user.id) return { success: false, error: "Design not found." };
  return { success: true, data: mapDesign(design) };
}

/** Creates a new design, or updates one the caller already owns when
 * `input.id` is supplied — the same "Save Design" action handles both, so
 * re-saving from the Review step never creates a duplicate row. */
export async function saveDesignAction(input: unknown): Promise<ActionResult<ProductDesignRecord>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const parsed = saveDesignSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  const product = await requireOwnedProduct(data.productId, user.id);
  if (!product) return { success: false, error: "Product not found." };

  if (data.id) {
    const existing = await requireOwnedDesign(data.id, user.id);
    if (!existing) return { success: false, error: "Design not found." };
    const updated = await db.productDesign.update({
      where: { id: data.id },
      data: { name: data.name, specification: data.specification, notes: data.notes ?? null },
      include: designInclude,
    });
    return { success: true, data: mapDesign(updated) };
  }

  const created = await db.productDesign.create({
    data: {
      productId: data.productId,
      ownerId: user.id,
      name: data.name,
      specification: data.specification,
      notes: data.notes ?? null,
    },
    include: designInclude,
  });
  return { success: true, data: mapDesign(created) };
}

export async function deleteDesignAction(id: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const design = await requireOwnedDesign(id, user.id);
  if (!design) return { success: false, error: "Design not found." };

  await db.productDesign.delete({ where: { id } });
  return { success: true, data: undefined };
}

export async function addDesignAttachmentAction(
  designId: string,
  input: { fileName: string; mimeType: string; sizeBytes: number; dataUrl: string }
): Promise<ActionResult<DesignAttachmentEntry>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const design = await requireOwnedDesign(designId, user.id);
  if (!design) return { success: false, error: "Design not found." };

  const v = validateDocument(input.mimeType, input.sizeBytes, input.fileName);
  if (!v.valid) return { success: false, error: v.error! };

  const attachment = await db.productDesignAttachment.create({ data: { designId, ...input } });
  return { success: true, data: mapAttachment(attachment) };
}

export async function removeDesignAttachmentAction(attachmentId: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const attachment = await db.productDesignAttachment.findUnique({
    where: { id: attachmentId },
    include: { design: { select: { ownerId: true } } },
  });
  if (!attachment || attachment.design.ownerId !== user.id) return { success: false, error: "Attachment not found." };

  await db.productDesignAttachment.delete({ where: { id: attachmentId } });
  return { success: true, data: undefined };
}
