import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { supplierSchema } from "@/lib/validations/supplier";
import { ensureSuppliersSeeded } from "@/lib/seed";
type DbPayload = Parameters<typeof db.supplierListing.create>[0]["data"];

function toDbPayload(data: ReturnType<typeof supplierSchema.parse>, extra?: { initials?: string; logoColor?: string }): DbPayload {
  return {
    companyName: data.companyName,
    description: data.description,
    industry: data.industry,
    supplierType: data.supplierType,
    country: data.country,
    city: data.city,
    products: data.products,
    minimumOrder: data.minimumOrder ?? null,
    responseTime: data.responseTime ?? null,
    phone: data.phone ?? null,
    email: data.email ?? null,
    website: data.website ?? null,
    whatsapp: data.whatsapp ?? null,
    linkedin: data.linkedin ?? null,
    verified: data.verified,
    rating: data.rating,
    yearEstablished: data.yearEstablished ? Number(data.yearEstablished) : null,
    employees: data.employees ?? null,
    notes: data.notes ?? null,
    initials: extra?.initials ?? data.companyName.slice(0, 2).toUpperCase(),
    logoColor: extra?.logoColor ?? "#6366F1",
  };
}

export async function GET() {
  try {
    // Idempotent backfill — adds any seed suppliers not yet in the DB.
    await ensureSuppliersSeeded();

    const suppliers = await db.supplierListing.findMany({
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(suppliers);
  } catch (err) {
    console.error("[GET /api/suppliers]", err);
    return NextResponse.json({ error: "Failed to fetch suppliers" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = supplierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    const initials = parsed.data.companyName.slice(0, 2).toUpperCase();
    const colors = ["#3B82F6","#EC4899","#10B981","#F59E0B","#84CC16","#06B6D4","#EF4444","#A855F7","#F97316","#6366F1"];
    const logoColor = colors[Math.floor(Math.random() * colors.length)];

    const supplier = await db.supplierListing.create({
      data: toDbPayload(parsed.data, { initials, logoColor }),
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (err) {
    console.error("[POST /api/suppliers]", err);
    return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 });
  }
}
