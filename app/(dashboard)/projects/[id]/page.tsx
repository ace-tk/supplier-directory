import { notFound } from "next/navigation";
import { getProjectWorkspace } from "@/services/project-management";
import { ProjectWorkspace } from "@/components/project-management/project-workspace";

export default async function ProjectWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectWorkspace(id);
  if (!project) notFound();
  return <ProjectWorkspace project={project} backHref="/projects" />;
}
