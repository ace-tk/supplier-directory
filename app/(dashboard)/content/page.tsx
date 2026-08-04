import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ContentDashboard } from "@/components/content/ContentDashboard";

export default async function ContentPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/content");

  return <ContentDashboard basePath="/content" />;
}
