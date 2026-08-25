import { redirect } from "next/navigation";
import { hasTeamPermission } from "@/lib/team-auth";
export default async function ProjectsAccessLayout({ children }: { children: React.ReactNode }) { if (!(await hasTeamPermission("projects.view"))) redirect("/unauthorized"); return children; }
