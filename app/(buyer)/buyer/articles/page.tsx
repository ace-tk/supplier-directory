import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ArticlesBoard } from "@/components/articles/ArticlesBoard";

export default async function BuyerArticlesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/articles");

  return <ArticlesBoard basePath="/buyer/articles" />;
}
