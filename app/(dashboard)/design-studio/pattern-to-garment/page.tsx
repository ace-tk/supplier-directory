import { StudioNav } from "@/components/design-studio/StudioNav";
import { PageHeader } from "@/components/layout/page-header";
import { PatternToGarmentStudio } from "@/components/pattern-to-garment/PatternToGarmentStudio";

export default function PatternToGarmentPage() {
  return (
    <div>
      <StudioNav />
      <div className="mt-6">
        <PageHeader
          title="Pattern to Garment"
          description="Upload each pattern piece and generate the stitched garment in front, back and side views — then download a pattern sheet with your pieces and measurements."
        />
      </div>
      <PatternToGarmentStudio />
    </div>
  );
}
