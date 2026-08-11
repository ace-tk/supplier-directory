import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ProductList } from "@/components/product/ProductList";

export default async function SupplierProductPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/supplier/product");

  return <ProductList basePath="/supplier/product" />;
}
