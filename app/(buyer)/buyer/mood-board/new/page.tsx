import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { createBoardAction } from "@/services/mood-board";

export default async function NewMoodBoardPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/mood-board");

  const result = await createBoardAction();
  if (!result.success) redirect("/buyer/mood-board");
  redirect(`/buyer/mood-board/${result.data.id}`);
}
