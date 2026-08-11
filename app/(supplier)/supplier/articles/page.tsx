import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ArticlesBoard } from "@/components/articles/ArticlesBoard";

export default async function SupplierArticlesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/supplier/articles");

  return <ArticlesBoard basePath="/supplier/articles" />;
}
