import { Package } from "lucide-react";
import { StudioNav } from "@/components/design-studio/StudioNav";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";

/**
 * Placeholder destination for a future embroidery asset library (logos,
 * motifs, patches, borders, typography, floral assets, ...). No data model,
 * browsing, or categorisation exists yet — this only reserves the nav entry
 * and route so that feature can be built here later without moving anything.
 */
export default function EmbroideryAssetsPage() {
  return (
    <div>
      <StudioNav />
      <div className="mt-6">
        <PageHeader title="Embroidery Assets" description="Manage and organize embroidery assets here in the future." />
      </div>

      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
        <Package className="h-6 w-6 text-muted-foreground" />
        <Badge variant="secondary" className="border-0 text-[10px]">
          Coming Soon
        </Badge>
        <p className="text-sm text-muted-foreground max-w-sm">
          Detailed categorization — logos, motifs, patches, borders, typography, floral assets and more — is coming later.
        </p>
      </div>
    </div>
  );
}
