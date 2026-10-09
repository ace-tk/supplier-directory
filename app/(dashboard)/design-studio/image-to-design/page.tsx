import { StudioNav } from "@/components/design-studio/StudioNav";
import { PageHeader } from "@/components/layout/page-header";
import { ImageToDesignStudio } from "@/components/image-to-design/ImageToDesignStudio";

export default async function ImageToDesignPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { open } = await searchParams;
  return (
    <div>
      <StudioNav />
      <div className="mt-6">
        <PageHeader title="Image to Design" description="Create new style options from an existing garment image." />
      </div>
      <ImageToDesignStudio openId={open} />
    </div>
  );
}
