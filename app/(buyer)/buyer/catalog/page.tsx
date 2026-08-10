import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { CatalogTable } from "@/components/catalog/CatalogTable";

export default async function BuyerCatalogPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/catalog");

  return <CatalogTable basePath="/buyer/catalog" />;
}
