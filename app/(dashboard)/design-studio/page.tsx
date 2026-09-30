import { Sparkles } from "lucide-react";
import { StudioNav } from "@/components/design-studio/StudioNav";
import { GarmentStudioCard } from "@/components/design-studio/GarmentStudioCard";
import { garmentStudioSections } from "@/lib/garment-studio-sections";

export default function AiDesignStudioHomePage() {
  return (
    <div className="space-y-10">
      {/* Header — deliberately warmer/more creative than a standard PageHeader:
          this is the front door to a workspace, not an admin data table. */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card px-6 py-8 sm:px-10 sm:py-10">
        <div className="relative flex flex-col gap-4">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-widest">AI Garment Studio</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground max-w-xl">
            Create, transform and prepare fashion designs with AI.
          </h1>
          <StudioNav />
        </div>
      </div>

      {/* Create New — every workflow, grouped into sections (config:
          lib/garment-studio-sections.ts). */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-1">Create something new</h2>
        <p className="text-sm text-muted-foreground mb-4">Choose a workflow to start.</p>
        <div className="space-y-[46px]">
          {garmentStudioSections.map((section) => (
            <section key={section.title}>
              <h3 className="mb-5 text-[21px] font-semibold text-foreground">{section.title}</h3>
              <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 min-[2200px]:grid-cols-5">
                {section.cards.map((card) => (
                  <GarmentStudioCard key={card.title} card={card} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
