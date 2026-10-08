// Read-only aggregates for the dashboard charts. Real counts only: "orders"
// are the platform's SALES invoices (the only order-like record that exists),
// and the network split is the user table grouped by role.

import { addDays, format, startOfDay, subDays } from "date-fns";
import { db } from "@/lib/db";

export interface OrdersPoint {
  /** yyyy-MM-dd, local server date */
  date: string;
  count: number;
}

/** Sales invoices created per day for the last 90 days (zeros included), oldest first. */
export async function getOrdersSeries(days = 90): Promise<OrdersPoint[]> {
  const today = startOfDay(new Date());
  const from = subDays(today, days - 1);
  const rows = await db.invoice.findMany({
    where: { type: "SALES", archivedAt: null, invoiceDate: { gte: from, lte: addDays(today, 1) } },
    select: { invoiceDate: true },
  });
  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) buckets.set(format(addDays(from, i), "yyyy-MM-dd"), 0);
  for (const r of rows) {
    const key = format(r.invoiceDate, "yyyy-MM-dd");
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets].map(([date, count]) => ({ date, count }));
}

export interface NetworkCounts {
  buyers: number;
  suppliers: number;
  freelancers: number;
}

export async function getNetworkCounts(): Promise<NetworkCounts> {
  const [buyers, suppliers, freelancers] = await Promise.all([
    db.user.count({ where: { role: "BUYER" } }),
    db.user.count({ where: { role: "SUPPLIER" } }),
    db.user.count({ where: { role: "FREELANCER" } }),
  ]);
  return { buyers, suppliers, freelancers };
}
