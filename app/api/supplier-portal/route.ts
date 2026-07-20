import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const portals = await db.supplierPortal.findMany({
      orderBy: { updatedAt: "desc" },
      include: { products: { orderBy: { sortOrder: "asc" } }, documents: true },
    });
    return NextResponse.json(portals);
  } catch (err) {
    console.error("[GET /api/supplier-portal]", err);
    return NextResponse.json({ error: "Failed to fetch portals" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const portal = await db.supplierPortal.create({
      data: {
        companyName: body.companyName ?? null,
        businessType: body.businessType ?? null,
        industry: body.industry ?? null,
        gst: body.gst ?? null,
        country: body.country ?? null,
        state: body.state ?? null,
        city: body.city ?? null,
        website: body.website ?? null,
        linkedin: body.linkedin ?? null,
        instagram: body.instagram ?? null,
        whatsapp: body.whatsapp ?? null,
        contactName: body.contactName ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        description: body.description ?? null,
        categories: body.categories ?? [],
        status: "draft",
      },
      include: { products: true, documents: true },
    });
    return NextResponse.json(portal, { status: 201 });
  } catch (err) {
    console.error("[POST /api/supplier-portal]", err);
    return NextResponse.json({ error: "Failed to create portal" }, { status: 500 });
  }
}
