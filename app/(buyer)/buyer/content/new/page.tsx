import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ContentEditor } from "@/components/content/ContentEditor";

export default async function NewBuyerContentPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/content/new");

  return <ContentEditor basePath="/buyer/content" initialItem={null} />;
}
