import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/session";
import { getBoardAction, getMyBoardsAction } from "@/services/mood-board";
import { MoodBoardStudio } from "@/components/mood-board/MoodBoardStudio";
import type { MoodBoardBasePaths } from "@/types/mood-board";

// Admin has a real Catalog editor and a real CRM inbox, but — confirmed by
// audit — no /product/[rowId]/manufacture route exists for Admin at all
// (only Buyer/Supplier/Freelancer have one), so Send to Manufacturer is
// honestly unavailable here rather than linking to a 404.
const ADMIN_BASE_PATHS: MoodBoardBasePaths = {
  moodBoard: "/mood-board",
  catalogEdit: "/catalog",
  manufacture: null,
  messages: "/crm",
  close: "/dashboard",
};

export default async function AdminMoodBoardStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login?from=/mood-board");

  const { id } = await params;
  const [boardResult, boardsResult] = await Promise.all([getBoardAction(id), getMyBoardsAction()]);
  if (!boardResult.success) notFound();

  return (
    <MoodBoardStudio
      initialBoard={boardResult.data}
      initialBoards={boardsResult.success ? boardsResult.data : []}
      basePaths={ADMIN_BASE_PATHS}
    />
  );
}
