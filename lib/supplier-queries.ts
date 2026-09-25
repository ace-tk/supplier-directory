import { db } from "@/lib/db";
import { ensureSuppliersSeeded } from "@/lib/seed";

/**
 * The full supplier directory listing — the exact same query used by both
 * GET /api/suppliers (the client-side fetch hooks/use-suppliers.ts falls
 * back to) and the Directory page's server-side initial render, so both
 * paths always return identical data. Extracted here so neither one drifts
 * from the other.
 */
export async function getSupplierDirectory() {
  await ensureSuppliersSeeded();
  return db.supplierListing.findMany({
    orderBy: { createdAt: "asc" },
    // Safety cap, not real pagination — this endpoint has no page/limit
    // params today and the UI renders whatever it gets in one shot, so a
    // real paginated response would change visible behavior. This just
    // stops the directory query/payload from growing unbounded as more
    // suppliers are added; current volume is far below this ceiling.
    take: 500,
  });
}
