import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ContentEditor } from "@/components/content/ContentEditor";

export default async function NewFreelancerContentPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/content/new");

  return <ContentEditor basePath="/freelancer/content" initialItem={null} />;
}
