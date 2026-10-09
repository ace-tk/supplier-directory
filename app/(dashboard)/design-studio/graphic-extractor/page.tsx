import { StudioNav } from "@/components/design-studio/StudioNav";
import { PageHeader } from "@/components/layout/page-header";
import { GraphicExtractorStudio } from "@/components/graphic-extractor/GraphicExtractorStudio";

export default async function GraphicExtractorPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { open } = await searchParams;
  return (
    <div>
      <StudioNav />
      <div className="mt-6">
        <PageHeader title="Graphic Extractor" description="Detect and extract complete patterns from product or reference images." />
      </div>
      <GraphicExtractorStudio openId={open} />
    </div>
  );
}
