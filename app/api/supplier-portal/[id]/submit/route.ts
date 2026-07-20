import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const { id } = await params;

    // Check if already submitted
    const existing = await db.supplierPortal.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.supplierCode) {
      return NextResponse.json({ supplierCode: existing.supplierCode });
    }

    // Atomically generate a unique SB-XXXXXX ID
    const seq = await db.supplierIdSequence.create({ data: {} });
    const supplierCode = `SB-${String(seq.id).padStart(6, "0")}`;

    const portal = await db.supplierPortal.update({
      where: { id },
      data: { supplierCode, status: "submitted" },
      include: {
        products: { orderBy: { sortOrder: "asc" } },
        documents: true,
      },
    });

    return NextResponse.json(portal);
  } catch (err) {
    console.error("[POST /api/supplier-portal/[id]/submit]", err);
    return NextResponse.json({ error: "Failed to submit portal" }, { status: 500 });
  }
}
