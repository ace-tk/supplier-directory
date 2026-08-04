import { db } from "@/lib/db";
import { SUPPLIERS as SEED_SUPPLIERS } from "@/data/suppliers";
import { PRODUCTS as SEED_PRODUCTS } from "@/data/products";
import { hashPassword, verifyPassword } from "@/lib/auth";

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

// Admin is never created through public signup (see signupSchema) — this
// seed is the only way a mock admin account exists, standing in for a real
// "created internally" provisioning flow (invite, internal tool, etc.)
// later. Each demo role has its own distinct, documented password (see
// README/onboarding docs) rather than sharing one across roles.
const DEMO_USERS = [
  { name: "Demo Buyer", email: "buyer@supplybase.com", role: "BUYER" as const, companyName: "Demo Buyer Co.", password: "Buyer@123" },
  { name: "Demo Supplier", email: "supplier@supplybase.com", role: "SUPPLIER" as const, companyName: "Demo Supplier Co.", password: "Supplier@123" },
  { name: "Demo Admin", email: "admin@supplybase.com", role: "ADMIN" as const, companyName: undefined, password: "Admin@123" },
  { name: "Demo Freelancer", email: "freelancer@supplybase.com", role: "FREELANCER" as const, companyName: undefined, password: "Freelancer@123" },
];

// Idempotent — cheap after the first run (one indexed count query), so it's
// safe to call from a hot path like loginAction. User.create can't be
// batched via createMany because of the nested Buyer/Supplier relation
// creates, so each missing demo user is created individually. For demo
// users that already exist, their password is kept in sync with the
// documented credential above (checked, not blindly overwritten) so the
// published demo logins never silently drift out of date.
export async function ensureDemoUsersSeeded() {
  for (const u of DEMO_USERS) {
    const existing = await db.user.findUnique({ where: { email: u.email }, select: { id: true, password: true } });

    if (!existing) {
      const hashed = await hashPassword(u.password);
      await db.user.create({
        data: {
          name: u.name,
          email: u.email,
          password: hashed,
          role: u.role,
          ...(u.role === "SUPPLIER" ? { supplier: { create: { companyName: u.companyName! } } } : {}),
          ...(u.role === "BUYER" ? { buyer: { create: { companyName: u.companyName! } } } : {}),
          ...(u.role === "FREELANCER"
            ? {
                freelancer: {
                  create: {
                    bio: "Freelance product photographer and catalog specialist working with wholesale suppliers to create conversion-ready listing content.",
                    location: "Bengaluru, India",
                    phone: "+91 98765 43210",
                    skills: ["Product Photography", "Catalog Design", "Adobe Photoshop", "Lightroom", "Content Writing"],
                    linkedinUrl: "https://linkedin.com/in/demo-freelancer",
                    githubUrl: "https://github.com/demo-freelancer",
                    availability: "AVAILABLE",
                    performanceScore: 82,
                  },
                },
              }
            : {}),
        },
      });
      continue;
    }

    const matches = await verifyPassword(u.password, existing.password);
    if (!matches) {
      const hashed = await hashPassword(u.password);
      await db.user.update({ where: { id: existing.id }, data: { password: hashed } });
    }
  }
}
