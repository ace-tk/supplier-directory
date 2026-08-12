import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { TemplateLibrary } from "@/components/content/TemplateLibrary";

export default async function BuyerTemplateLibraryPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/content/templates");

  const { category } = await searchParams;
  return <TemplateLibrary basePath="/buyer/content" initialCategory={category} />;
}
