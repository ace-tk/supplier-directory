import { Eye, TrendingUp, Package } from "lucide-react";
import { getUser } from "@/lib/session";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { StatWidget } from "@/components/portal/stat-widget";
import { getSupplierAnalytics } from "@/lib/mock-data";

export default async function SupplierAnalyticsPage() {
  const user = await getUser();
  const analytics = getSupplierAnalytics(user?.id ?? "guest");
  const maxViews = Math.max(...analytics.viewsTrend.map((v) => v.value));
  const maxTopViews = Math.max(...analytics.topProducts.map((p) => p.views));

  return (
    <div className="space-y-8">
      <PageHeader title="Analytics" description="How buyers are discovering and engaging with your catalog." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatWidget icon={Eye} label="Total Views (6 mo)" value={analytics.totalViews.toLocaleString()} />
        <StatWidget icon={TrendingUp} label="Conversion Rate" value={`${analytics.conversionRate}%`} sublabel="enquiry to order" />
        <StatWidget icon={Package} label="Top Product Views" value={analytics.topProducts[0]?.views.toLocaleString() ?? "—"} />
      </div>

      <section>
        <SectionHeader title="Views Trend" description="Product page views over the last 6 months." />
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-end gap-4 h-40">
            {analytics.viewsTrend.map((point) => (
              <div key={point.label} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end h-32">
                  <div
                    className="w-full rounded-t-md bg-primary/70 hover:bg-primary transition-colors"
                    style={{ height: `${(point.value / maxViews) * 100}%` }}
                    title={`${point.value.toLocaleString()} views`}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground">{point.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <SectionHeader title="Top Products" description="Your most-viewed listings." />
        <div className="rounded-xl border border-border bg-card divide-y divide-border/60">
          {analytics.topProducts.map((p) => (
            <div key={p.name} className="flex items-center gap-4 p-4">
              <span className="text-sm text-foreground flex-1 truncate">{p.name}</span>
              <div className="w-40 h-2 rounded-full bg-muted overflow-hidden shrink-0">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(p.views / maxTopViews) * 100}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-16 text-right shrink-0">{p.views.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
