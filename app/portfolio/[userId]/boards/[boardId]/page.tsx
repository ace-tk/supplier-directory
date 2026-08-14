import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPublishedPortfolioByUserId } from "@/lib/portfolio-queries";

// Pinterest-style board detail — reuses the same publish gate as the parent
// portfolio page, so an unpublished (or since-unpublished) portfolio's
// boards are never reachable directly by URL either.
export default async function PublicBoardPage({
  params,
}: {
  params: Promise<{ userId: string; boardId: string }>;
}) {
  const { userId, boardId } = await params;
  const portfolio = await getPublishedPortfolioByUserId(userId);
  const board = portfolio?.boards.find((b) => b.id === boardId);

  if (!portfolio || !board) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-neutral-900 px-6">
        <div className="text-center max-w-sm">
          <p className="text-xs font-semibold tracking-[0.25em] uppercase text-neutral-400">Board</p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">Board not found</h1>
          <p className="mt-2 text-sm text-neutral-500">This board doesn&apos;t exist or isn&apos;t published.</p>
          <Link href="/" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-900 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        </div>
      </div>
    );
  }

  const pins = [...board.pins].sort((a, b) => a.position - b.position);

  return (
    <div className="bg-white text-neutral-900 min-h-screen">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-6 md:px-10 h-16 flex items-center gap-4">
          <Link href={`/portfolio/${userId}`} className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors">
            <ArrowLeft className="h-4 w-4" /> {portfolio.hero.name}
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 md:px-10 py-12 md:py-16">
        <p className="text-xs font-semibold tracking-[0.25em] uppercase text-neutral-400">Board</p>
        <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">{board.title}</h1>
        {board.description && <p className="mt-3 max-w-xl text-neutral-600">{board.description}</p>}
        <p className="mt-2 text-sm text-neutral-500">
          {pins.length} pin{pins.length === 1 ? "" : "s"}
        </p>

        {pins.length === 0 ? (
          <p className="mt-10 text-sm text-neutral-400">No pins on this board yet.</p>
        ) : (
          <div className="mt-10 columns-2 sm:columns-3 gap-4 [column-fill:_balance]">
            {pins.map((pin) => {
              const content = (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pin.image} alt={pin.title ?? board.title} loading="lazy" className="w-full rounded-lg" />
              );
              return (
                <div key={pin.id} className="break-inside-avoid mb-4 group">
                  {pin.externalUrl ? (
                    <a href={pin.externalUrl} target="_blank" rel="noreferrer" className="block">
                      {content}
                    </a>
                  ) : (
                    content
                  )}
                  {pin.title && <p className="text-sm font-medium mt-1">{pin.title}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
