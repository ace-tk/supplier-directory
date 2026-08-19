import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { getMyBoardsAction } from "@/services/mood-board";

/**
 * Admin's "Mood Board" sidebar entry — mirrors
 * app/(buyer)/buyer/mood-board/page.tsx exactly: resolves straight into
 * the Studio (most recently updated board, or a freshly created one),
 * never an intermediate list.
 */
export default async function AdminMoodBoardEntryPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/mood-board");

  const result = await getMyBoardsAction();
  const mostRecent = result.success ? result.data[0] : undefined;

  if (mostRecent) redirect(`/mood-board/${mostRecent.id}`);
  redirect("/mood-board/new");
}
