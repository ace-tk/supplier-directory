import { CampaignsView } from "@/components/admin/marketing/campaigns-view";
import { getCampaignsByAudience } from "@/services/marketing-service";

export default function SupplierCampaignsPage() {
  return (
    <CampaignsView
      title="Supplier Campaigns"
      description="Campaigns targeted at onboarding, retaining, and re-engaging suppliers."
      campaigns={getCampaignsByAudience("Supplier")}
    />
  );
}
