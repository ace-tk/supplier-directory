import { redirect } from "next/navigation";
import { hasTeamPermission } from "@/lib/team-auth";
export default async function CrmAccessLayout({ children }: { children: React.ReactNode }) { if (!(await hasTeamPermission("crm.view"))) redirect("/unauthorized"); return children; }
