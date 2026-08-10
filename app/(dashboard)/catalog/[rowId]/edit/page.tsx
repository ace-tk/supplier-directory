import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/session";
import { getOrCreateCatalogForOwner } from "@/lib/catalog-queries";
import { CatalogItemForm } from "@/components/catalog/CatalogItemForm";

export default async function EditCatalogItemPage({ params }: { params: Promise<{ rowId: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login?from=/catalog");

  const { rowId } = await params;
  const catalog = await getOrCreateCatalogForOwner(user.id);
  const row = catalog.rows.find((r) => r.id === rowId);
  if (!row) notFound();

  return <CatalogItemForm basePath="/catalog" initialRow={row} />;
}
