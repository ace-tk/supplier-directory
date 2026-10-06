import { StudioNav } from "@/components/design-studio/StudioNav";
import { PageHeader } from "@/components/layout/page-header";
import { HitCollectionStudio } from "@/components/hit-collection/HitCollectionStudio";

export default async function HitCollectionProposalPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { open } = await searchParams;
  return (
    <div>
      <StudioNav />
      <div className="mt-6">
        <PageHeader title="Hit Collection Proposal" description="Extend a bestseller into cohesive style variations while preserving its core design language." />
      </div>
      <HitCollectionStudio openId={open} />
    </div>
  );
}
