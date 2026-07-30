import { db } from "@/lib/db";
import { SUPPLIERS as SEED_SUPPLIERS } from "@/data/suppliers";
import { PRODUCTS as SEED_PRODUCTS } from "@/data/products";

export async function ensureSuppliersSeeded() {
  await db.supplierListing.createMany({
    data: SEED_SUPPLIERS.map((s) => ({
      id: s.id,
      companyName: s.companyName,
      description: s.description,
      industry: s.industry,
      supplierType: s.supplierType,
      country: s.country,
      city: s.city,
      rating: s.rating,
      reviewCount: s.reviewCount,
      verified: s.verified,
      products: s.products,
      responseTime: s.responseTime,
      minimumOrder: s.minimumOrder,
      phone: s.phone,
      email: s.email,
      website: s.website,
      whatsapp: s.whatsapp,
      linkedin: s.linkedin,
      initials: s.initials,
      logoColor: s.logoColor,
      yearEstablished: s.yearEstablished,
      employees: s.employees,
      savedCount: s.savedCount,
      notes: null,
    })),
    skipDuplicates: true,
  });
}

export async function ensureProductsSeeded() {
  await ensureSuppliersSeeded();
  await db.product.createMany({
    data: SEED_PRODUCTS,
    skipDuplicates: true,
  });
}
