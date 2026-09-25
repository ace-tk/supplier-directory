import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { StreamedCatalogTable } from "@/components/catalog/StreamedCatalogTable";

export default async function FreelancerCatalogPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/catalog");

  // Still fetched on the server (so the client component renders with real
  // data and skips its own fetch on mount), but inside a Suspense boundary
  // so the shell + skeleton stream first instead of the whole response
  // waiting on the catalog query.
  return <StreamedCatalogTable basePath="/freelancer/catalog" userId={user.id} />;
}
