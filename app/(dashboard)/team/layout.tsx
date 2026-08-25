import { redirect } from "next/navigation";
import { hasTeamPermission } from "@/lib/team-auth";
export default async function TeamAccessLayout({ children }: { children: React.ReactNode }) { if (!(await hasTeamPermission("team.view"))) redirect("/unauthorized"); return children; }
