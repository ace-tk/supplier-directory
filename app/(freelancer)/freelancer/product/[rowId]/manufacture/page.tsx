import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/session";
import { getOrCreateCatalogForOwner } from "@/lib/catalog-queries";
import { getDesignAction } from "@/services/design";
import { ManufactureYourOwn } from "@/components/product/manufacture/ManufactureYourOwn";

export default async function FreelancerProductManufacturePage({
  params,
  searchParams,
}: {
  params: Promise<{ rowId: string }>;
  searchParams: Promise<{ designId?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/product");

  const { rowId } = await params;
  const { designId } = await searchParams;
  const catalog = await getOrCreateCatalogForOwner(user.id);
  const row = catalog.rows.find((r) => r.id === rowId);
  if (!row) notFound();

  let initialDesign = null;
  if (designId) {
    const result = await getDesignAction(designId);
    if (result.success && result.data.productId === row.id) initialDesign = result.data;
  }

  return <ManufactureYourOwn basePath="/freelancer/product" row={row} initialDesign={initialDesign} />;
}
