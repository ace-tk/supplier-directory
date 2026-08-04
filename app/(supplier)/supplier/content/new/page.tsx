import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ContentEditor } from "@/components/content/ContentEditor";

export default async function NewSupplierContentPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/supplier/content/new");

  return <ContentEditor basePath="/supplier/content" initialItem={null} />;
}
