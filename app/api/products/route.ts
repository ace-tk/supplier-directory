import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureProductsSeeded } from "@/lib/seed";
import { Prisma } from "@/lib/generated/prisma/client";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const category = searchParams.get('category');
    const country = searchParams.get('country');
    const search = searchParams.get('search');
    const supplierId = searchParams.get('supplierId');
    const sort = searchParams.get('sort');
    const city = searchParams.get('city');
    const material = searchParams.get('material');
    const verified = searchParams.get('verified');
    const exportOnly = searchParams.get('export');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Idempotent backfill — adds any seed suppliers/products not yet in the DB.
    await ensureProductsSeeded();

    // Build filter
    const where: Prisma.ProductWhereInput = {};
    if (id) where.id = id;
    if (category && category !== 'All Categories') where.category = category;
    if (country && country !== 'All Countries') where.country = country;
    if (supplierId) where.supplierId = supplierId;
    if (material && material !== 'All Materials') where.material = { contains: material, mode: 'insensitive' };
    if (exportOnly === 'true') where.country = { not: 'India' };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { material: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (city && city !== 'All Cities' || verified === 'true') {
      where.supplier = {
        ...(city && city !== 'All Cities' ? { city } : {}),
        ...(verified === 'true' ? { verified: true } : {}),
      };
    }

    // Build order
    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
    if (sort === 'trending') orderBy = { savedCount: 'desc' };
    if (sort === 'moq') orderBy = { moq: 'asc' }; // simplistic, string sorting
    if (sort === 'newest') orderBy = { createdAt: 'desc' };

    const products = await db.product.findMany({
      where,
      orderBy,
      include: {
        supplier: true
      },
      take: limit,
      skip: (page - 1) * limit,
    });

    // Real "Global Buyers" — distinct BUYER-role users who saved each
    // product, derived from the persisted SavedProduct join table (unique
    // per userId+productId). One grouped query for the whole page, not
    // per-card, so this never becomes N+1 as the result set grows.
    const buyerSaveCounts = await db.savedProduct.groupBy({
      by: ["productId"],
      where: { productId: { in: products.map((p) => p.id) }, user: { role: "BUYER" } },
      _count: { _all: true },
    });
    const globalBuyersByProductId = new Map(buyerSaveCounts.map((r) => [r.productId, r._count._all]));

    const productsWithGlobalBuyers = products.map((p) => ({
      ...p,
      globalBuyers: globalBuyersByProductId.get(p.id) ?? 0,
    }));

    return NextResponse.json(productsWithGlobalBuyers);
  } catch (err) {
    console.error("[GET /api/products]", err);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
