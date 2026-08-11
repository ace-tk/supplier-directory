import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ProductForm } from "@/components/product/ProductForm";

export default async function NewFreelancerProductPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/product/new");

  return <ProductForm basePath="/freelancer/product" initialRow={null} />;
}
