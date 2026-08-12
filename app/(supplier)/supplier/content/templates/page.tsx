import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { TemplateLibrary } from "@/components/content/TemplateLibrary";

export default async function SupplierTemplateLibraryPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login?from=/supplier/content/templates");

  const { category } = await searchParams;
  return <TemplateLibrary basePath="/supplier/content" initialCategory={category} />;
}
