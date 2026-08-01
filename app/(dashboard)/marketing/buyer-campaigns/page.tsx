import { CampaignsView } from "@/components/admin/marketing/campaigns-view";
import { getCampaignsByAudience } from "@/services/marketing-service";

export default function BuyerCampaignsPage() {
  return (
    <CampaignsView
      title="Buyer Campaigns"
      description="Campaigns targeted at buyers browsing and purchasing on SupplyBase."
      campaigns={getCampaignsByAudience("Buyer")}
    />
  );
}
