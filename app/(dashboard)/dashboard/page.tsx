import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { DashboardOverview } from "@/features/dashboard/dashboard-overview";
import { getAdminDashboardStats, getAdminGettingStarted, getAdminTasks, getAdminRecentActivity } from "@/lib/dashboard-queries";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [stats, gettingStarted, tasksState, activity] = await Promise.all([
    getAdminDashboardStats(),
    getAdminGettingStarted(),
    getAdminTasks(),
    getAdminRecentActivity(),
  ]);

  return (
    <DashboardOverview
      user={session.user}
      stats={stats}
      gettingStarted={gettingStarted}
      tasksState={tasksState}
      activity={activity}
    />
  );
}
