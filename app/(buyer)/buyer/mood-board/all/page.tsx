import { redirect } from "next/navigation";
import Link from "next/link";
import { ImageOff, Sparkles, Plus } from "lucide-react";
import { getUser } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { getMyBoardsAction } from "@/services/mood-board";

/**
 * Secondary "browse all boards" grid — not linked from the sidebar (which
 * now opens the Studio directly, see ../page.tsx), kept as a real,
 * working fallback since the Studio's own "Boards" left-tool-panel
 * already covers switching between boards day to day.
 */
export default async function AllMoodBoardsPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/mood-board");

  const result = await getMyBoardsAction();
  const boards = result.success ? result.data : [];

  return (
    <div>
      <PageHeader
        title="All Mood Boards"
        description="Every board you've created."
        actions={
          <Button render={<Link href="/buyer/mood-board/new" />} nativeButton={false} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New Board
          </Button>
        }
      />

      {boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-rose-500/10 text-rose-500">
            <Sparkles className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-foreground">No boards yet</p>
          <p className="text-xs text-muted-foreground max-w-xs">Create your first mood board to start collecting inspiration and building a design concept.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
          {boards.map((b) => (
            <Link key={b.id} href={`/buyer/mood-board/${b.id}`} className="block rounded-2xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-video bg-muted flex items-center justify-center">
                {b.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.coverImage} alt={b.name} className="w-full h-full object-cover" />
                ) : (
                  <ImageOff className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-foreground truncate">{b.name}</p>
                <p className="text-xs text-muted-foreground">{b.itemCount} items</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
