import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ContentDashboard } from "@/components/content/ContentDashboard";

export default async function FreelancerContentPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/content");

  return <ContentDashboard basePath="/freelancer/content" />;
}
