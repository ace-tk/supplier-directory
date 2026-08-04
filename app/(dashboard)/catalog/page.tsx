import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { CatalogTable } from "@/components/catalog/CatalogTable";

export default async function CatalogPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/catalog");

  return <CatalogTable />;
}
