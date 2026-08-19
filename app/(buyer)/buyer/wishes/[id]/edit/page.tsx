import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/session";
import { getWishAction } from "@/services/wishes";
import { WishForm } from "@/components/wishes/WishForm";

export default async function EditWishPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/wishes");

  const { id } = await params;
  const result = await getWishAction(id);
  if (!result.success) notFound();

  // Submitted wishes are read-only for the buyer — send them to the
  // detail view instead of a form that services/wishes.ts would reject anyway.
  if (result.data.status !== "DRAFT") redirect(`/buyer/wishes/${id}`);

  return <WishForm wish={result.data} />;
}
