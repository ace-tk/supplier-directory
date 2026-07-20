import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { supplierSchema } from "@/lib/validations/supplier";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  try {
    const supplier = await db.supplierListing.findUnique({ where: { id } });
    if (!supplier) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(supplier);
  } catch (err) {
    console.error("[GET /api/suppliers/:id]", err);
    return NextResponse.json({ error: "Failed to fetch supplier" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = supplierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    const existing = await db.supplierListing.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const supplier = await db.supplierListing.update({
      where: { id },
      data: {
        companyName: parsed.data.companyName,
        description: parsed.data.description,
        industry: parsed.data.industry,
        supplierType: parsed.data.supplierType,
        country: parsed.data.country,
        city: parsed.data.city,
        products: parsed.data.products,
        minimumOrder: parsed.data.minimumOrder ?? null,
        responseTime: parsed.data.responseTime ?? null,
        phone: parsed.data.phone ?? null,
        email: parsed.data.email ?? null,
        website: parsed.data.website ?? null,
        whatsapp: parsed.data.whatsapp ?? null,
        linkedin: parsed.data.linkedin ?? null,
        verified: parsed.data.verified,
        rating: parsed.data.rating,
        yearEstablished: parsed.data.yearEstablished ? Number(parsed.data.yearEstablished) : null,
        employees: parsed.data.employees ?? null,
        notes: parsed.data.notes ?? null,
        initials: parsed.data.companyName.slice(0, 2).toUpperCase(),
      },
    });

    return NextResponse.json(supplier);
  } catch (err) {
    console.error("[PATCH /api/suppliers/:id]", err);
    return NextResponse.json({ error: "Failed to update supplier" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  try {
    const existing = await db.supplierListing.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await db.supplierListing.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/suppliers/:id]", err);
    return NextResponse.json({ error: "Failed to delete supplier" }, { status: 500 });
  }
}
