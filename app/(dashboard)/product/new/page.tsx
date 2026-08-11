import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ProductForm } from "@/components/product/ProductForm";

export default async function NewProductPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/product/new");

  return <ProductForm basePath="/product" initialRow={null} />;
}
