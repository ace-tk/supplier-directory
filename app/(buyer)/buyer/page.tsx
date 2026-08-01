import Link from "next/link";
import { Bookmark, ClipboardList, Handshake, Video, Eye, ArrowRight } from "lucide-react";
import { getUser } from "@/lib/session";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { StatWidget } from "@/components/portal/stat-widget";
import {
  getSavedSuppliers,
  getBuyerOrders,
  getBuyerCounterOffers,
  getBuyerVideoRequests,
  getRecentlyViewedProducts,
} from "@/lib/mock-data";

export default async function BuyerDashboardPage() {
  const user = await getUser();
  const userId = user?.id ?? "guest";

  const saved = getSavedSuppliers(userId);
  const orders = getBuyerOrders(userId);
  const offers = getBuyerCounterOffers(userId);
  const videoRequests = getBuyerVideoRequests(userId);
  const recentlyViewed = getRecentlyViewedProducts(userId);

  const activeOrders = orders.filter((o) => o.status === "Processing" || o.status === "Shipped").length;
  const pendingOffers = offers.filter((o) => o.status === "Pending").length;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${user?.name.split(" ")[0] ?? "Buyer"}`}
        description="Here's what's happening across your sourcing activity."
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatWidget icon={Bookmark} label="Saved Suppliers" value={saved.length} />
        <StatWidget icon={ClipboardList} label="Active Orders" value={activeOrders} />
        <StatWidget icon={Handshake} label="Pending Counter Offers" value={pendingOffers} />
        <StatWidget icon={Video} label="Video Requests" value={videoRequests.length} />
        <StatWidget icon={Eye} label="Recently Viewed" value={recentlyViewed.length} />
      </div>

      <section>
        <SectionHeader
          title="Recently Viewed Products"
          actions={
            <Link href="/buyer/shop" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Browse Shop <ArrowRight className="h-3 w-3" />
            </Link>
          }
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {recentlyViewed.map((p) => (
            <Link
              key={p.id}
              href="/buyer/shop"
              className="group rounded-xl overflow-hidden border border-border bg-card hover:shadow-card hover:border-border/80 transition-all"
            >
              <div className="aspect-square overflow-hidden bg-muted">
                <img
                  src={p.images[0]}
                  alt={p.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <div className="p-2.5">
                <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{p.priceRange}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
