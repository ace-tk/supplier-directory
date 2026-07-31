import { getUser } from "@/lib/session";
import { Sidebar } from "@/components/navigation/sidebar";
import { TopNavbar } from "@/components/navigation/top-navbar";
import { SessionProvider } from "@/components/shared/session-provider";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  className?: string;
}

export async function AppShell({ children, className }: AppShellProps) {
  const user = await getUser();

  return (
    <SessionProvider user={user}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopNavbar user={user} />
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
