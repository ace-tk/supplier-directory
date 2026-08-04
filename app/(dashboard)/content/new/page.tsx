import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ContentEditor } from "@/components/content/ContentEditor";

export default async function NewContentPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/content/new");

  return <ContentEditor basePath="/content" initialItem={null} />;
}
