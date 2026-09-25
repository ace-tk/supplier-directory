import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { getOrCreateCatalogForOwner } from "@/lib/catalog-queries";
import { CatalogTable } from "@/components/catalog/CatalogTable";

export default async function SupplierCatalogPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/supplier/catalog");

  // Fetched here (same query CatalogTable's own getCatalogAction() would
  // otherwise call on mount) so the table renders with real data on first
  // paint instead of an empty shell followed by a client round-trip.
  const initialCatalog = await getOrCreateCatalogForOwner(user.id);
  return <CatalogTable basePath="/supplier/catalog" initialCatalog={initialCatalog} />;
}
