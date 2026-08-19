import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { getMyBoardsAction } from "@/services/mood-board";

/**
 * "Mood Board" in the sidebar must open the AI Mood Board Studio directly
 * — not an intermediate list. This route only ever resolves and redirects:
 * into the user's most recently updated board's Studio if one exists, or
 * into /mood-board/new (which creates one and redirects) otherwise. The
 * Studio itself lives at ./[id]/page.tsx and is untouched by this change.
 */
export default async function MoodBoardEntryPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/mood-board");

  const result = await getMyBoardsAction();
  const mostRecent = result.success ? result.data[0] : undefined;

  if (mostRecent) redirect(`/buyer/mood-board/${mostRecent.id}`);
  redirect("/buyer/mood-board/new");
}
