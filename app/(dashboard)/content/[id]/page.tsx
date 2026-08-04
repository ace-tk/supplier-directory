import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/session";
import { getContentItemForOwner } from "@/lib/content-queries";
import { ContentEditor } from "@/components/content/ContentEditor";

export default async function EditContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login?from=/content");

  const { id } = await params;
  const { preview } = await searchParams;
  const item = await getContentItemForOwner(id, user.id);
  if (!item) notFound();

  return <ContentEditor basePath="/content" initialItem={item} startInPreview={preview === "1"} />;
}
