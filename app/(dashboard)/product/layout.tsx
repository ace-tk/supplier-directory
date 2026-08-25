import { redirect } from "next/navigation";
import { hasTeamPermission } from "@/lib/team-auth";
export default async function Access({ children }: { children: React.ReactNode }) { if (!(await hasTeamPermission("product.view"))) redirect("/unauthorized"); return children; }
