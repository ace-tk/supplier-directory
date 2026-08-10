import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { CatalogItemForm } from "@/components/catalog/CatalogItemForm";

export default async function NewBuyerCatalogItemPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/catalog/new");

  return <CatalogItemForm basePath="/buyer/catalog" initialRow={null} />;
}
