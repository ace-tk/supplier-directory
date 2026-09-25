import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { getContentListForOwner, getTemplatesForOwner } from "@/lib/content-queries";
import { ContentDashboard } from "@/components/content/ContentDashboard";

export default async function BuyerContentPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/content");

  // Fetched here (the same two queries ContentDashboard's own
  // getContentListAction()/getTemplatesAction() would otherwise call on
  // mount) so the dashboard renders with real data on first paint instead
  // of an empty shell followed by a client round-trip.
  const [initialItems, initialTemplates] = await Promise.all([getContentListForOwner(user.id), getTemplatesForOwner(user.id)]);
  return <ContentDashboard basePath="/buyer/content" initialItems={initialItems} initialTemplates={initialTemplates} />;
}
