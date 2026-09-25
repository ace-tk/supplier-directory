import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { StreamedContentDashboard } from "@/components/content/StreamedContentDashboard";

export default async function SupplierContentPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/supplier/content");

  // Still fetched on the server (so the client component renders with real
  // data and skips its own fetch on mount), but inside a Suspense boundary
  // so the shell + skeleton stream first instead of the whole response
  // waiting on the content + template queries.
  return <StreamedContentDashboard basePath="/supplier/content" userId={user.id} />;
}
