import { getPublishedPortfolioByUserId } from "@/lib/portfolio-queries";
import { PortfolioRenderer } from "@/components/portfolio/templates/registry";

// Public, read-only one-page portfolio, keyed by User.id (the freelancer
// identifier used everywhere else in the app). Draft content is never
// reachable here — getPublishedPortfolioByUserId only returns a result when
// the freelancer has explicitly published, regardless of who's viewing.
export default async function PublicPortfolioPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const portfolio = await getPublishedPortfolioByUserId(userId);

  if (!portfolio) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-neutral-900 px-6">
        <div className="text-center max-w-sm">
          <p className="text-xs font-semibold tracking-[0.25em] uppercase text-neutral-400">Portfolio</p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">Portfolio not published yet</h1>
          <p className="mt-2 text-sm text-neutral-500">This freelancer hasn&apos;t published their portfolio.</p>
        </div>
      </div>
    );
  }

  return <PortfolioRenderer data={portfolio} />;
}
