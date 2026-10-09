import { StudioNav } from "@/components/design-studio/StudioNav";
import { PageHeader } from "@/components/layout/page-header";
import { DetailToDesignStudio } from "@/components/detail-to-design/DetailToDesignStudio";

export default async function DetailToDesignPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { open } = await searchParams;
  return (
    <div>
      <StudioNav />
      <div className="mt-6">
        <PageHeader title="Detail to Design" description="Turn a neckline, sleeve, pocket or other detail reference into multiple apparel concepts." />
      </div>
      <DetailToDesignStudio openId={open} />
    </div>
  );
}
