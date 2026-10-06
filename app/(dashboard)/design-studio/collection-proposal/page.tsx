import { StudioNav } from "@/components/design-studio/StudioNav";
import { PageHeader } from "@/components/layout/page-header";
import { CollectionBoardStudio } from "@/components/collection-proposal/CollectionBoardStudio";

export default async function CollectionProposalPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { open } = await searchParams;
  return (
    <div>
      <StudioNav />
      <div className="mt-6">
        <PageHeader title="Collection Proposal" description="Build a cohesive collection proposal around a bestseller with aligned themes and design language." />
      </div>
      <CollectionBoardStudio openId={open} />
    </div>
  );
}
