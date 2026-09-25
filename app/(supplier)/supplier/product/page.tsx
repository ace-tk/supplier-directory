import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { StreamedProductList } from "@/components/product/StreamedProductList";

export default async function SupplierProductPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/supplier/product");

  // Still fetched on the server (so the client component renders with real
  // data and skips its own fetch on mount), but inside a Suspense boundary
  // so the shell + skeleton stream first instead of the whole response
  // waiting on the catalog query.
  return <StreamedProductList basePath="/supplier/product" userId={user.id} />;
}
