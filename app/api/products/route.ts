import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PRODUCTS as SEED_PRODUCTS } from "@/data/products";
import { Prisma } from "@/lib/generated/prisma/client";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const country = searchParams.get('country');
    const search = searchParams.get('search');
    const supplierId = searchParams.get('supplierId');
    const sort = searchParams.get('sort');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = 20;

    // First check if products exist, seed if not
    const count = await db.product.count();
    
    if (count === 0) {
      // Need to seed
      await db.product.createMany({
        data: SEED_PRODUCTS,
        skipDuplicates: true,
      });
    }

    // Build filter
    const where: Prisma.ProductWhereInput = {};
    if (category && category !== 'All Categories') where.category = category;
    if (country && country !== 'All Countries') where.country = country;
    if (supplierId) where.supplierId = supplierId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
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

    return NextResponse.json(products);
  } catch (err) {
    console.error("[GET /api/products]", err);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
