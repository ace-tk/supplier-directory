import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AppShell } from "@/components/layout/app-shell";
import { roleHome } from "@/lib/roles";
import { getCurrentWorkspaceAccess } from "@/lib/team-auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // This shell is the Admin Portal — everything under it is unchanged from
  // before, just now scoped to admins. Buyers/Suppliers are sent home to
  // their own portal instead of a dead-end "unauthorized" page.
  //
  // Reuses the same cached getCurrentWorkspaceAccess() that AppShell (below)
  // and every module layout's hasTeamPermission() call already use, so this
  // membership lookup runs at most once per request instead of being
  // re-queried by each of them independently.
  if (session.user.role !== "ADMIN") {
    const access = await getCurrentWorkspaceAccess();
    if (!access) redirect(roleHome(session.user.role));
  }

  return <AppShell>{children}</AppShell>;
}
