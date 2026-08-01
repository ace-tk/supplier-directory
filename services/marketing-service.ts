// Mock marketing service — same swap-later contract as inventory-service.ts.

import { hashString, pick, dateAgo } from "@/lib/mock-data";
import type { CampaignRecord, CampaignChannel, CampaignAudience, CampaignAnalyticsSummary } from "@/types/marketing";

function mockLatency(ms = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const CAMPAIGN_NAMES: Record<CampaignChannel, string[]> = {
  Email: [
    "Monsoon Wholesale Discount",
    "New Supplier Spotlight",
    "Bulk Order Reminder",
    "Festive Season Catalog Drop",
    "Re-engagement: Inactive Buyers",
    "Verified Supplier Digest",
  ],
  WhatsApp: [
    "Flash Sale Alert",
    "Order Confirmation Follow-up",
    "New Arrivals Broadcast",
    "Payment Reminder",
    "Restock Notification",
  ],
  Promotional: [
    "End of Season Clearance",
    "First Order 10% Off",
    "Refer a Buyer, Get Credit",
    "Bundle & Save Promo",
    "Trade Show Special",
  ],
  Newsletter: [
    "SupplyBase Monthly Digest",
    "Supplier Success Stories",
    "Industry Trends Roundup",
    "Platform Feature Updates",
  ],
};

const STATUSES: CampaignRecord["status"][] = ["Draft", "Scheduled", "Active", "Completed", "Completed"];
const AUDIENCES: CampaignAudience[] = ["Buyer", "Supplier", "All"];

let campaignsCache: CampaignRecord[] | null = null;

export function getCampaigns(): CampaignRecord[] {
  if (campaignsCache) return campaignsCache;

  const channels = Object.keys(CAMPAIGN_NAMES) as CampaignChannel[];
  const records: CampaignRecord[] = [];

  channels.forEach((channel) => {
    CAMPAIGN_NAMES[channel].forEach((name, i) => {
      const key = `campaign-${channel}-${i}`;
      const recipients = 200 + (hashString(`${key}-recipients`) % 4800);
      records.push({
        id: key,
        name,
        channel,
        audience: pick(AUDIENCES, `${key}-audience`),
        status: pick(STATUSES, `${key}-status`),
        recipients,
        openRate: 20 + (hashString(`${key}-open`) % 55),
        clickRate: 3 + (hashString(`${key}-click`) % 25),
        scheduledDate: dateAgo(hashString(`${key}-date`) % 40),
      });
    });
  });

  campaignsCache = records.sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());
  return campaignsCache;
}

export function getCampaignsByChannel(channel: CampaignChannel): CampaignRecord[] {
  return getCampaigns().filter((c) => c.channel === channel);
}

export function getScheduledCampaigns(): CampaignRecord[] {
  return getCampaigns().filter((c) => c.status === "Scheduled");
}

export function getCampaignsByAudience(audience: "Buyer" | "Supplier"): CampaignRecord[] {
  return getCampaigns().filter((c) => c.audience === audience || c.audience === "All");
}

export function getCampaignAnalytics(): CampaignAnalyticsSummary {
  const campaigns = getCampaigns();
  const months = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];

  return {
    totalCampaigns: campaigns.length,
    totalRecipients: campaigns.reduce((sum, c) => sum + c.recipients, 0),
    avgOpenRate: Math.round(campaigns.reduce((sum, c) => sum + c.openRate, 0) / campaigns.length),
    avgClickRate: Math.round(campaigns.reduce((sum, c) => sum + c.clickRate, 0) / campaigns.length),
    performanceTrend: months.map((label, i) => ({
      label,
      value: 30 + (hashString(`campaign-trend-${label}-${i}`) % 45),
    })),
    topCampaigns: [...campaigns]
      .sort((a, b) => b.openRate - a.openRate)
      .slice(0, 5)
      .map((c) => ({ name: c.name, openRate: c.openRate })),
  };
}

// Mock mutation — swap for real `POST /api/campaigns` later.
export async function createCampaign(): Promise<{ success: true }> {
  await mockLatency(700);
  return { success: true };
}
