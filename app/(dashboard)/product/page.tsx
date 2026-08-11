import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ProductList } from "@/components/product/ProductList";

export default async function ProductPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/product");

  return <ProductList basePath="/product" />;
}
