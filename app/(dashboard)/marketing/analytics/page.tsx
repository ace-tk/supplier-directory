import { Megaphone, Users2, Mail, MousePointerClick } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatWidget } from "@/components/portal/stat-widget";
import { getCampaignAnalytics } from "@/services/marketing-service";

export default function CampaignAnalyticsPage() {
  const analytics = getCampaignAnalytics();
  const maxTrend = Math.max(...analytics.performanceTrend.map((p) => p.value));
  const maxOpenRate = Math.max(...analytics.topCampaigns.map((c) => c.openRate));

  return (
    <div>
      <PageHeader title="Campaign Analytics" description="Performance across every marketing channel." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatWidget icon={Megaphone} label="Total Campaigns" value={analytics.totalCampaigns} />
        <StatWidget icon={Users2} label="Total Recipients" value={analytics.totalRecipients.toLocaleString("en-IN")} />
        <StatWidget icon={Mail} label="Avg Open Rate" value={`${analytics.avgOpenRate}%`} accentClassName="text-emerald-500" />
        <StatWidget icon={MousePointerClick} label="Avg Click Rate" value={`${analytics.avgClickRate}%`} accentClassName="text-blue-500" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-card border border-border p-5">
          <p className="text-sm font-medium text-foreground mb-4">Open Rate Trend</p>
          <div className="flex items-end gap-2 h-40">
            {analytics.performanceTrend.map((point) => (
              <div key={point.label} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full flex items-end h-32">
                  <div
                    className="w-full rounded-t-md bg-primary/70"
                    style={{ height: `${(point.value / maxTrend) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground">{point.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-card border border-border p-5">
          <p className="text-sm font-medium text-foreground mb-4">Top Performing Campaigns</p>
          <div className="space-y-3">
            {analytics.topCampaigns.map((c) => (
              <div key={c.name} className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground flex-1 truncate">{c.name}</span>
                <div className="w-24 h-2 rounded-full bg-muted overflow-hidden shrink-0">
                  <div className="h-full bg-primary/70 rounded-full" style={{ width: `${(c.openRate / maxOpenRate) * 100}%` }} />
                </div>
                <span className="text-sm text-foreground w-10 text-right shrink-0">{c.openRate}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
