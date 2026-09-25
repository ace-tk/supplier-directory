import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { getOrCreateCatalogForOwner } from "@/lib/catalog-queries";
import { ProductList } from "@/components/product/ProductList";

export default async function FreelancerProductPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/product");

  // Fetched here (same query ProductList's own getCatalogAction() would
  // otherwise call on mount) so the list renders with real data on first
  // paint instead of an empty shell followed by a client round-trip.
  const initialCatalog = await getOrCreateCatalogForOwner(user.id);
  return <ProductList basePath="/freelancer/product" initialCatalog={initialCatalog} />;
}
