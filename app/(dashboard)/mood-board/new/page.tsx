import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { createBoardAction } from "@/services/mood-board";

export default async function AdminNewMoodBoardPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/mood-board");

  const result = await createBoardAction();
  if (!result.success) redirect("/mood-board");
  redirect(`/mood-board/${result.data.id}`);
}
