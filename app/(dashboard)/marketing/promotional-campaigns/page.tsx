import { CampaignsView } from "@/components/admin/marketing/campaigns-view";
import { getCampaignsByChannel } from "@/services/marketing-service";

export default function PromotionalCampaignsPage() {
  return (
    <CampaignsView
      title="Promotional Campaigns"
      description="Discounts, referral incentives, and seasonal clearance promotions."
      campaigns={getCampaignsByChannel("Promotional")}
      showChannelColumn={false}
    />
  );
}
