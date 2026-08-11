import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ProductForm } from "@/components/product/ProductForm";

export default async function NewBuyerProductPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/product/new");

  return <ProductForm basePath="/buyer/product" initialRow={null} />;
}
