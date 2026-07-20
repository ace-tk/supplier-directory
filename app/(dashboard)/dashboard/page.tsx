import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { DashboardOverview } from "@/features/dashboard/dashboard-overview";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <DashboardOverview user={session.user} />;
}
