import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ProductList } from "@/components/product/ProductList";

export default async function FreelancerProductPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/product");

  return <ProductList basePath="/freelancer/product" />;
}
