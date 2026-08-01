import { CampaignsView } from "@/components/admin/marketing/campaigns-view";
import { getCampaignsByChannel } from "@/services/marketing-service";

export default function WhatsAppCampaignsPage() {
  return (
    <CampaignsView
      title="WhatsApp Campaigns"
      description="Broadcast messages, order updates, and flash sale alerts over WhatsApp."
      campaigns={getCampaignsByChannel("WhatsApp")}
      showChannelColumn={false}
    />
  );
}
