import { StudioNav } from "@/components/design-studio/StudioNav";
import { PageHeader } from "@/components/layout/page-header";
import { OutfitDesignStudio } from "@/components/outfit-design/OutfitDesignStudio";

export default async function OutfitDesignPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { open } = await searchParams;
  return (
    <div>
      <StudioNav />
      <div className="mt-6">
        <PageHeader title="Outfit Design" description="One-click to generate matched garments from a single top or bottom for fast complete-set creation." />
      </div>
      <OutfitDesignStudio openId={open} />
    </div>
  );
}
