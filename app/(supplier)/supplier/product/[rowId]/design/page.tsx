import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/session";
import { getOrCreateCatalogForOwner } from "@/lib/catalog-queries";
import { getDesignAction } from "@/services/design";
import { DesignYourOwn } from "@/components/product/design/DesignYourOwn";

export default async function SupplierProductDesignPage({
  params,
  searchParams,
}: {
  params: Promise<{ rowId: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login?from=/supplier/product");

  const { rowId } = await params;
  const { edit } = await searchParams;
  const catalog = await getOrCreateCatalogForOwner(user.id);
  const row = catalog.rows.find((r) => r.id === rowId);
  if (!row) notFound();

  let initialDesign = null;
  if (edit) {
    const result = await getDesignAction(edit);
    if (result.success && result.data.productId === row.id) initialDesign = result.data;
  }

  return <DesignYourOwn basePath="/supplier/product" row={row} initialDesign={initialDesign} />;
}
