export type CampaignChannel = "Email" | "WhatsApp" | "Promotional" | "Newsletter";
export type CampaignAudience = "Buyer" | "Supplier" | "All";
export type CampaignStatus = "Draft" | "Scheduled" | "Active" | "Completed";

export interface CampaignRecord {
  id: string;
  name: string;
  channel: CampaignChannel;
  audience: CampaignAudience;
  status: CampaignStatus;
  recipients: number;
  openRate: number;
  clickRate: number;
  scheduledDate: string;
}

export interface CampaignAnalyticsSummary {
  totalCampaigns: number;
  totalRecipients: number;
  avgOpenRate: number;
  avgClickRate: number;
  performanceTrend: { label: string; value: number }[];
  topCampaigns: { name: string; openRate: number }[];
}
