import Link from "next/link";
import { ArrowRight, Clock, FolderOpen, Sparkles } from "lucide-react";
import { StudioNav } from "@/components/design-studio/StudioNav";
import { Badge } from "@/components/ui/badge";
import { designStudioProposalCards, designStudioWorkflows } from "@/lib/design-studio-workflows";
import { getGarmentDesignsAction } from "@/services/garment-studio";
import { getRecentRepeatPrintDesignsAction } from "@/services/repeat-print";
import { formatRelativeTime } from "@/utils/format";
import { cn } from "@/lib/utils";

interface RecentItem {
  id: string;
  name: string;
  image: string;
  updatedAt: string;
  href: string;
  kind: "Garment" | "Print";
}

export default async function AiDesignStudioHomePage() {
  const [garmentResult, printResult] = await Promise.all([
    getGarmentDesignsAction("all"),
    getRecentRepeatPrintDesignsAction(),
  ]);

  const garmentItems: RecentItem[] = garmentResult.success
    ? garmentResult.data.map((d) => ({ id: d.id, name: d.name, image: d.image, updatedAt: d.updatedAt, href: `/design-studio/garment/${d.id}`, kind: "Garment" as const }))
    : [];
  const printItems: RecentItem[] = printResult.success
    ? printResult.data.map((d) => ({ id: d.id, name: d.name, image: d.tileImage, updatedAt: d.updatedAt, href: `/design-studio/pattern-library`, kind: "Print" as const }))
    : [];

  const recentWork = [...garmentItems, ...printItems]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8);

  const savedPatterns = printResult.success ? printResult.data.slice(0, 6) : [];

  return (
    <div className="space-y-10">
      {/* Header — deliberately warmer/more creative than a standard PageHeader:
          this is the front door to a workspace, not an admin data table. */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card px-6 py-8 sm:px-10 sm:py-10">
        <div className="relative flex flex-col gap-4">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-widest">AI Design Studio</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground max-w-xl">
            Create, transform and prepare fashion designs with AI.
          </h1>
          <StudioNav />
        </div>
      </div>

      {/* Create New — the core workflow picker. */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-1">Create something new</h2>
        <p className="text-sm text-muted-foreground mb-4">Choose a workflow to start.</p>
        {/* Display-only for now — no workflow behind these yet. The image is a
            CSS background so a not-yet-added file leaves a plain muted panel
            instead of a broken-image icon. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {designStudioProposalCards.map((card) => (
            <div key={card.id} className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card">
              <div
                role="img"
                aria-label={card.name}
                className="aspect-[3/2] w-full bg-muted bg-cover bg-center"
                style={{ backgroundImage: `url(${card.image})` }}
              />
              <div className="p-5">
                <p className="text-sm font-semibold text-foreground">{card.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{card.description}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {designStudioWorkflows.map((workflow) => {
            const isAvailable = workflow.status === "available";
            const card = (
              <div
                className={cn(
                  "group relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all",
                  isAvailable ? "hover:border-primary/50 hover:shadow-md" : "opacity-60"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <workflow.icon className="h-5 w-5" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{workflow.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{workflow.description}</p>
                </div>
                {isAvailable && (
                  <div className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Open <ArrowRight className="h-3 w-3" />
                  </div>
                )}
              </div>
            );
            return isAvailable ? (
              <Link key={workflow.id} href={workflow.href} className="block h-full">
                {card}
              </Link>
            ) : (
              <div key={workflow.id} className="h-full cursor-not-allowed">
                {card}
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent Work — real data only, no placeholders when empty. */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" /> Recent Work
            </h2>
            <p className="text-sm text-muted-foreground">Continue where you left off.</p>
          </div>
        </div>
        {recentWork.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-12 text-center">
            <FolderOpen className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No projects yet. Start from a workflow above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {recentWork.map((item) => (
              <Link key={`${item.kind}-${item.id}`} href={item.href} className="group block">
                <div className="relative overflow-hidden rounded-xl border border-border bg-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.image} alt={item.name} className="w-full aspect-square object-cover" />
                  <Badge variant="secondary" className="absolute top-1.5 left-1.5 border-0 text-[9px] bg-black/60 text-white">
                    {item.kind}
                  </Badge>
                </div>
                <p className="mt-1.5 text-xs font-medium text-foreground truncate">{item.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{formatRelativeTime(new Date(item.updatedAt))}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Pattern Library preview */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Pattern Library</h2>
            <p className="text-sm text-muted-foreground">Saved patterns, ready to reuse in AI Garment Studio.</p>
          </div>
          <Link href="/design-studio/pattern-library" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {savedPatterns.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-12 text-center">
            <p className="text-sm text-muted-foreground">No saved patterns yet — create one in Repeat Print Maker.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {savedPatterns.map((p) => (
              <Link key={p.id} href="/design-studio/pattern-library" className="block rounded-xl overflow-hidden border border-border bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.tileImage} alt={p.name} className="w-full aspect-square object-cover" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
