import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { getTemplatesForOwner } from "@/lib/content-queries";
import { TemplateLibrary } from "@/components/content/TemplateLibrary";

export default async function FreelancerTemplateLibraryPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/content/templates");

  const { category } = await searchParams;
  // Fetched here (the same query TemplateLibrary's own getTemplatesAction()
  // would otherwise call on mount) so the library renders with real data on
  // first paint instead of an empty shell followed by a client round-trip.
  const initialTemplates = await getTemplatesForOwner(user.id);
  return <TemplateLibrary basePath="/freelancer/content" initialCategory={category} initialTemplates={initialTemplates} />;
}
