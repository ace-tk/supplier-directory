import { CampaignsView } from "@/components/admin/marketing/campaigns-view";
import { getScheduledCampaigns } from "@/services/marketing-service";

export default function ScheduledCampaignsPage() {
  return (
    <CampaignsView
      title="Scheduled Campaigns"
      description="Campaigns queued to send across all channels."
      campaigns={getScheduledCampaigns()}
    />
  );
}
