import { redirect } from "next/navigation";
import { hasTeamPermission } from "@/lib/team-auth";
export default async function MoodBoardAccessLayout({ children }: { children: React.ReactNode }) { if (!(await hasTeamPermission("moodboard.view"))) redirect("/unauthorized"); return children; }
