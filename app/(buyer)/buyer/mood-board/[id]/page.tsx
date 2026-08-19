import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/session";
import { getBoardAction, getMyBoardsAction } from "@/services/mood-board";
import { MoodBoardStudio } from "@/components/mood-board/MoodBoardStudio";

export default async function MoodBoardStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/mood-board");

  const { id } = await params;
  const [boardResult, boardsResult] = await Promise.all([getBoardAction(id), getMyBoardsAction()]);
  if (!boardResult.success) notFound();

  return <MoodBoardStudio initialBoard={boardResult.data} initialBoards={boardsResult.success ? boardsResult.data : []} />;
}
