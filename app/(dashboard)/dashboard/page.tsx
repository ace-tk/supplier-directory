import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { DashboardOverview } from "@/features/dashboard/dashboard-overview";
import { getOrdersSeries, getNetworkCounts } from "@/lib/dashboard-chart-queries";
import { getAdminDashboardStats, getAdminGettingStarted, getAdminTasks, getAdminRecentActivity } from "@/lib/dashboard-queries";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [stats, gettingStarted, tasksState, activity, ordersSeries, network] = await Promise.all([
    getAdminDashboardStats(),
    getAdminGettingStarted(),
    getAdminTasks(),
    getAdminRecentActivity(),
    getOrdersSeries(),
    getNetworkCounts(),
  ]);

  return (
    <DashboardOverview
      user={session.user}
      stats={stats}
      gettingStarted={gettingStarted}
      tasksState={tasksState}
      activity={activity}
      ordersSeries={ordersSeries}
      network={network}
    />
  );
}
