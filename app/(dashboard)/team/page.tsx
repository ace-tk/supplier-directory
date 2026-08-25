import { redirect } from "next/navigation";
import { getTeamManagementData } from "@/services/team-management";
import { TeamManagementClient } from "@/components/admin/team/team-management-client";

export default async function TeamManagementPage() {
  const data = await getTeamManagementData();
  if (!data) redirect("/unauthorized");
  return <TeamManagementClient initialData={data} />;
}
