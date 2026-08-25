import { redirect } from "next/navigation";
import { hasTeamPermission } from "@/lib/team-auth";
export default async function ContentAccessLayout({ children }: { children: React.ReactNode }) { if (!(await hasTeamPermission("content.view"))) redirect("/unauthorized"); return children; }
