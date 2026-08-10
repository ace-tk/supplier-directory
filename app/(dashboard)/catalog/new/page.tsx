import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { CatalogItemForm } from "@/components/catalog/CatalogItemForm";

export default async function NewCatalogItemPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/catalog/new");

  return <CatalogItemForm basePath="/catalog" initialRow={null} />;
}
