import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { CatalogItemForm } from "@/components/catalog/CatalogItemForm";

export default async function NewFreelancerCatalogItemPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/catalog/new");

  return <CatalogItemForm basePath="/freelancer/catalog" initialRow={null} />;
}
