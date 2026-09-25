import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { StreamedTemplateLibrary } from "@/components/content/StreamedTemplateLibrary";

export default async function SupplierTemplateLibraryPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login?from=/supplier/content/templates");

  const { category } = await searchParams;
  // Still fetched on the server (so the client component renders with real
  // data and skips its own fetch on mount), but inside a Suspense boundary
  // so the shell + skeleton stream first instead of the whole response
  // waiting on the templates query.
  return <StreamedTemplateLibrary basePath="/supplier/content" userId={user.id} initialCategory={category} />;
}
