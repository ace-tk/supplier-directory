import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { CatalogTable } from "@/components/catalog/CatalogTable";

export default async function SupplierCatalogPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/supplier/catalog");

  return <CatalogTable />;
}
