import { StudioNav } from "@/components/design-studio/StudioNav";
import { PageHeader } from "@/components/layout/page-header";
import { DetailToDesignStudio } from "@/components/detail-to-design/DetailToDesignStudio";

export default async function FabricToDesignPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { open } = await searchParams;
  return (
    <div>
      <StudioNav />
      <div className="mt-6">
        <PageHeader title="Fabric to Design" description="Create apparel concepts that match the color, texture and drape of a fabric reference." />
      </div>
      <DetailToDesignStudio kind="fabric" openId={open} />
    </div>
  );
}
