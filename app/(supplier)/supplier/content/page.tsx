import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ContentDashboard } from "@/components/content/ContentDashboard";

export default async function SupplierContentPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/supplier/content");

  return <ContentDashboard basePath="/supplier/content" />;
}
