import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ArticlesBoard } from "@/components/articles/ArticlesBoard";

export default async function ArticlesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/articles");

  return <ArticlesBoard basePath="/articles" />;
}
