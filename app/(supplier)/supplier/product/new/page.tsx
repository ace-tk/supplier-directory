import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ProductForm } from "@/components/product/ProductForm";

export default async function NewSupplierProductPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/supplier/product/new");

  return <ProductForm basePath="/supplier/product" initialRow={null} />;
}
