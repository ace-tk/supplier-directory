import Link from "next/link";
import { Eye, Inbox, Handshake, ClipboardList, Wallet, CircleCheck, ArrowRight } from "lucide-react";
import { getUser } from "@/lib/session";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { StatWidget } from "@/components/portal/stat-widget";
import { StatusBadge } from "@/components/portal/status-badge";
import {
  getSupplierOrders,
  getSupplierEnquiries,
  getSupplierCounterOffers,
  getSupplierAnalytics,
  getProfileCompletion,
  formatMockDate,
} from "@/lib/mock-data";

export default async function SupplierDashboardPage() {
  const user = await getUser();
  const userId = user?.id ?? "guest";

  const orders = getSupplierOrders(userId);
  const enquiries = getSupplierEnquiries(userId);
  const offers = getSupplierCounterOffers(userId);
  const analytics = getSupplierAnalytics(userId);
  const profileCompletion = getProfileCompletion(userId);

  const revenue = orders
    .filter((o) => o.status === "Delivered")
    .reduce((sum, o) => sum + parseInt(o.total.replace(/[^\d]/g, ""), 10), 0);
  const pendingOffers = offers.filter((o) => o.status === "Pending").length;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${user?.name.split(" ")[0] ?? "Supplier"}`}
        description="Here's how your storefront is performing."
      />

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatWidget icon={Eye} label="Product Views" value={analytics.totalViews.toLocaleString()} />
        <StatWidget icon={Inbox} label="Buyer Enquiries" value={enquiries.length} />
        <StatWidget icon={Handshake} label="Counter Offers" value={pendingOffers} sublabel="pending" />
        <StatWidget icon={ClipboardList} label="Orders" value={orders.length} />
        <StatWidget icon={Wallet} label="Revenue" value={`₹${revenue.toLocaleString("en-IN")}`} />
        <StatWidget icon={CircleCheck} label="Profile Completion" value={`${profileCompletion}%`} />
      </div>

      <section>
        <SectionHeader
          title="Recent Buyer Enquiries"
          actions={
            <Link href="/supplier/enquiries" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          }
        />
        <div className="rounded-xl border border-border bg-card divide-y divide-border/60">
          {enquiries.slice(0, 5).map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {e.buyerName} <span className="text-muted-foreground font-normal">— {e.productName}</span>
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{e.message}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={e.status} />
                <span className="text-[11px] text-muted-foreground w-20 text-right">{formatMockDate(e.date)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
