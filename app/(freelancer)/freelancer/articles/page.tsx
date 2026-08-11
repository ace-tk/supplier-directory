import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ArticlesBoard } from "@/components/articles/ArticlesBoard";

export default async function FreelancerArticlesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/articles");

  return <ArticlesBoard basePath="/freelancer/articles" />;
}
