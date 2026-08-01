import { CampaignsView } from "@/components/admin/marketing/campaigns-view";
import { getCampaignsByChannel } from "@/services/marketing-service";

export default function NewsletterPage() {
  return (
    <CampaignsView
      title="Newsletter"
      description="Recurring digests covering platform updates and supplier stories."
      campaigns={getCampaignsByChannel("Newsletter")}
      showChannelColumn={false}
    />
  );
}
