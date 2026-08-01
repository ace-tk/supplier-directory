import { CampaignsView } from "@/components/admin/marketing/campaigns-view";
import { getCampaignsByChannel } from "@/services/marketing-service";

export default function EmailCampaignsPage() {
  return (
    <CampaignsView
      title="Email Campaigns"
      description="Manage newsletter blasts, catalog drops, and re-engagement emails."
      campaigns={getCampaignsByChannel("Email")}
      showChannelColumn={false}
    />
  );
}
