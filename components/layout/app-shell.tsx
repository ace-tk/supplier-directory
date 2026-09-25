import { getUser } from "@/lib/session";
import { getCurrentWorkspaceAccess } from "@/lib/team-auth";
import { Sidebar } from "@/components/navigation/sidebar";
import { TopNavbar } from "@/components/navigation/top-navbar";
import { SessionProvider } from "@/components/shared/session-provider";
import type { PortalKey } from "@/lib/roles";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  className?: string;
  portal?: PortalKey;
}

export async function AppShell({ children, className, portal }: AppShellProps) {
  const user = await getUser();
  // Reuses the same cached getCurrentWorkspaceAccess() that the (dashboard)
  // layout and every module layout's hasTeamPermission() call already use,
  // so within one request this membership lookup runs at most once instead
  // of being re-queried by each of them independently.
  const access = user && user.role !== "ADMIN" ? await getCurrentWorkspaceAccess() : null;
  const permissions = user?.role === "ADMIN" ? ["*"] : (access?.permissions ?? []);

  return (
    <SessionProvider user={user}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar user={user} portal={portal} permissions={permissions} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopNavbar user={user} portal={portal} permissions={permissions} />
          <main
            className={cn(
              "flex-1 overflow-y-auto scrollbar-thin",
              "px-6 py-6 lg:px-8 lg:py-8",
              className
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
