import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { getOrCreateCatalogForOwner } from "@/lib/catalog-queries";
import { CatalogTable } from "@/components/catalog/CatalogTable";

export default async function BuyerCatalogPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/catalog");

  // Fetched here (same query CatalogTable's own getCatalogAction() would
  // otherwise call on mount) so the table renders with real data on first
  // paint instead of an empty shell followed by a client round-trip.
  const initialCatalog = await getOrCreateCatalogForOwner(user.id);
  return <CatalogTable basePath="/buyer/catalog" initialCatalog={initialCatalog} />;
}
