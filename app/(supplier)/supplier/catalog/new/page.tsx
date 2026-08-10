import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { CatalogItemForm } from "@/components/catalog/CatalogItemForm";

export default async function NewSupplierCatalogItemPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/supplier/catalog/new");

  return <CatalogItemForm basePath="/supplier/catalog" initialRow={null} />;
}
