import { getProjectManagementOverview } from "@/services/project-management";
import { ProjectManagementDashboard } from "@/components/project-management/project-management-dashboard";

export default async function ProjectManagementPage() {
  const overview = await getProjectManagementOverview();
  return <ProjectManagementDashboard initialData={overview} />;
}
