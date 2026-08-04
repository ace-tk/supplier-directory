import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ContentDashboard } from "@/components/content/ContentDashboard";

export default async function BuyerContentPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/content");

  return <ContentDashboard basePath="/buyer/content" />;
}
