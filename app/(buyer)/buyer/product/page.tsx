import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ProductList } from "@/components/product/ProductList";

export default async function BuyerProductPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/product");

  return <ProductList basePath="/buyer/product" />;
}
