import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/session";
import { getOrCreateCatalogForOwner } from "@/lib/catalog-queries";
import { ProductForm } from "@/components/product/ProductForm";
import { getProductFormSuggestions } from "@/lib/catalog-ui";

export default async function EditProductPage({ params }: { params: Promise<{ rowId: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login?from=/product");

  const { rowId } = await params;
  const catalog = await getOrCreateCatalogForOwner(user.id);
  const row = catalog.rows.find((r) => r.id === rowId);
  if (!row) notFound();

  // Derived from the catalog already loaded above, so ProductForm doesn't
  // re-fetch the same catalog on mount just to build these lists.
  return <ProductForm basePath="/product" initialRow={row} initialSuggestions={getProductFormSuggestions(catalog.rows)} />;
}
