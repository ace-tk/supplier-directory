"use server";

// "Manufacture Your Own" persistence + real supplier matching. Mirrors
// services/design.ts's structure and services/catalog.ts's ownership-check
// pattern.

import { db } from "@/lib/db";
import { validateDocument } from "@/lib/file-validation";
import { getUser } from "@/lib/session";
import { submitManufacturingRequestSchema } from "@/lib/validations/design";
import type { DesignSpecification, ManufacturingRequestRecord, DesignAttachmentEntry } from "@/types/design";

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const user = await getUser();
  return user ?? null;
}

function toSpecification(json: unknown): DesignSpecification {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  return json as DesignSpecification;
}

const requestInclude = {
  product: { select: { productName: true } },
  attachments: { orderBy: { createdAt: "asc" as const } },
};

type RequestWithRelations = Awaited<ReturnType<typeof fetchRequestRaw>>;

function fetchRequestRaw(id: string) {
  return db.manufacturingRequest.findUnique({ where: { id }, include: requestInclude });
}

function mapRequest(r: NonNullable<RequestWithRelations>): ManufacturingRequestRecord {
  return {
    id: r.id,
    productId: r.productId,
    productName: r.product.productName,
    designId: r.designId,
    ownerId: r.ownerId,
    specification: toSpecification(r.specification),
    quantity: r.quantity,
    targetPrice: r.targetPrice,
    currency: r.currency,
    sampleRequired: r.sampleRequired,
    deliveryLocation: r.deliveryLocation,
    requiredBy: r.requiredBy ? r.requiredBy.toISOString() : null,
    notes: r.notes,
    status: r.status,
    attachments: r.attachments.map(mapAttachment),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
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

export async function getManufacturingRequestAction(id: string): Promise<ActionResult<ManufacturingRequestRecord>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const request = await fetchRequestRaw(id);
  if (!request || request.ownerId !== user.id) return { success: false, error: "Manufacturing request not found." };
  return { success: true, data: mapRequest(request) };
}

export async function listManufacturingRequestsForProductAction(productId: string): Promise<ActionResult<ManufacturingRequestRecord[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const product = await requireOwnedProduct(productId, user.id);
  if (!product) return { success: false, error: "Product not found." };

  const rows = await db.manufacturingRequest.findMany({
    where: { productId, ownerId: user.id },
    include: requestInclude,
    orderBy: { createdAt: "desc" },
  });
  return { success: true, data: rows.map(mapRequest) };
}

export async function submitManufacturingRequestAction(input: unknown): Promise<ActionResult<ManufacturingRequestRecord>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const parsed = submitManufacturingRequestSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  const product = await requireOwnedProduct(data.productId, user.id);
  if (!product) return { success: false, error: "Product not found." };

  if (data.designId) {
    const design = await db.productDesign.findUnique({ where: { id: data.designId }, select: { ownerId: true, productId: true } });
    if (!design || design.ownerId !== user.id || design.productId !== data.productId) {
      return { success: false, error: "Design not found." };
    }
  }

  const created = await db.manufacturingRequest.create({
    data: {
      productId: data.productId,
      designId: data.designId ?? null,
      ownerId: user.id,
      specification: data.specification,
      quantity: data.quantity,
      targetPrice: data.targetPrice ?? null,
      currency: data.currency,
      sampleRequired: data.sampleRequired,
      deliveryLocation: data.deliveryLocation ?? null,
      requiredBy: data.requiredBy ? new Date(data.requiredBy) : null,
      notes: data.notes ?? null,
    },
    include: requestInclude,
  });
  return { success: true, data: mapRequest(created) };
}

export async function addManufacturingRequestAttachmentAction(
  requestId: string,
  input: { fileName: string; mimeType: string; sizeBytes: number; dataUrl: string }
): Promise<ActionResult<DesignAttachmentEntry>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const request = await db.manufacturingRequest.findUnique({ where: { id: requestId }, select: { ownerId: true } });
  if (!request || request.ownerId !== user.id) return { success: false, error: "Manufacturing request not found." };

  const v = validateDocument(input.mimeType, input.sizeBytes, input.fileName);
  if (!v.valid) return { success: false, error: v.error! };

  const attachment = await db.manufacturingRequestAttachment.create({ data: { requestId, ...input } });
  return { success: true, data: mapAttachment(attachment) };
}

export async function removeManufacturingRequestAttachmentAction(attachmentId: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const attachment = await db.manufacturingRequestAttachment.findUnique({
    where: { id: attachmentId },
    include: { request: { select: { ownerId: true } } },
  });
  if (!attachment || attachment.request.ownerId !== user.id) return { success: false, error: "Attachment not found." };

  await db.manufacturingRequestAttachment.delete({ where: { id: attachmentId } });
  return { success: true, data: undefined };
}

export interface SupplierMatch {
  id: string;
  companyName: string;
  industry: string;
  supplierType: string;
  city: string;
  country: string;
  rating: number;
  verified: boolean;
  matchReason: string;
}

/**
 * Real supplier matching against SupplierListing (the app's actual supplier
 * directory data) — no fabricated match percentages. A listing is surfaced
 * only when it genuinely matches on industry/supplier-type text (a real
 * column), and is labeled "Recommended" or "Relevant Supplier" rather than
 * a made-up score, per the task's explicit instruction.
 */
export async function findMatchingSuppliersAction(category: string): Promise<ActionResult<SupplierMatch[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const trimmed = category.trim();
  if (!trimmed) return { success: true, data: [] };

  const listings = await db.supplierListing.findMany({
    where: {
      OR: [
        { industry: { contains: trimmed, mode: "insensitive" } },
        { supplierType: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    orderBy: [{ verified: "desc" }, { rating: "desc" }],
    take: 6,
    select: { id: true, companyName: true, industry: true, supplierType: true, city: true, country: true, rating: true, verified: true },
  });

  return {
    success: true,
    data: listings.map((s) => ({
      ...s,
      matchReason: s.verified ? "Recommended" : "Relevant Supplier",
    })),
  };
}
