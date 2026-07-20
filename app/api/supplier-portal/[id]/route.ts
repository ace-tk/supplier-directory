import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const include = {
  products: { orderBy: { sortOrder: "asc" as const } },
  documents: true,
} as const;

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const portal = await db.supplierPortal.findUnique({ where: { id }, include });
    if (!portal) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(portal);
  } catch (err) {
    console.error("[GET /api/supplier-portal/[id]]", err);
    return NextResponse.json({ error: "Failed to fetch portal" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Handle products upsert if provided
    if (Array.isArray(body.products)) {
      await db.portalProduct.deleteMany({ where: { portalId: id } });
      if (body.products.length > 0) {
        await db.portalProduct.createMany({
          data: body.products.map(
            (p: { name: string; category: string; moq?: string; priceRange?: string; description?: string; images?: string[]; sortOrder?: number }, i: number) => ({
              portalId: id,
              name: p.name,
              category: p.category,
              moq: p.moq ?? null,
              priceRange: p.priceRange ?? null,
              description: p.description ?? null,
              images: p.images ?? [],
              sortOrder: p.sortOrder ?? i,
            })
          ),
        });
      }
      delete body.products;
    }

    // Handle documents upsert if provided
    if (Array.isArray(body.documents)) {
      await db.portalDocument.deleteMany({ where: { portalId: id } });
      if (body.documents.length > 0) {
        await db.portalDocument.createMany({
          data: body.documents.map(
            (d: { docType: string; fileName: string; fileUrl: string; fileSize?: number }) => ({
              portalId: id,
              docType: d.docType,
              fileName: d.fileName,
              fileUrl: d.fileUrl,
              fileSize: d.fileSize ?? null,
            })
          ),
        });
      }
      delete body.documents;
    }

    const portal = await db.supplierPortal.update({
      where: { id },
      data: {
        ...(body.companyName !== undefined && { companyName: body.companyName || null }),
        ...(body.businessType !== undefined && { businessType: body.businessType || null }),
        ...(body.industry !== undefined && { industry: body.industry || null }),
        ...(body.gst !== undefined && { gst: body.gst || null }),
        ...(body.country !== undefined && { country: body.country || null }),
        ...(body.state !== undefined && { state: body.state || null }),
        ...(body.city !== undefined && { city: body.city || null }),
        ...(body.website !== undefined && { website: body.website || null }),
        ...(body.linkedin !== undefined && { linkedin: body.linkedin || null }),
        ...(body.instagram !== undefined && { instagram: body.instagram || null }),
        ...(body.whatsapp !== undefined && { whatsapp: body.whatsapp || null }),
        ...(body.contactName !== undefined && { contactName: body.contactName || null }),
        ...(body.email !== undefined && { email: body.email || null }),
        ...(body.phone !== undefined && { phone: body.phone || null }),
        ...(body.description !== undefined && { description: body.description || null }),
        ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl || null }),
        ...(body.coverUrl !== undefined && { coverUrl: body.coverUrl || null }),
        ...(Array.isArray(body.categories) && { categories: body.categories }),
        ...(body.status !== undefined && { status: body.status }),
      },
      include,
    });
    return NextResponse.json(portal);
  } catch (err) {
    console.error("[PATCH /api/supplier-portal/[id]]", err);
    return NextResponse.json({ error: "Failed to update portal" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    await db.supplierPortal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/supplier-portal/[id]]", err);
    return NextResponse.json({ error: "Failed to delete portal" }, { status: 500 });
  }
}
