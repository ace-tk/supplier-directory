import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AppShell } from "@/components/layout/app-shell";
import { roleHome } from "@/lib/roles";

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
  if (session.user.role !== "ADMIN") {
    redirect(roleHome(session.user.role));
  }

  return <AppShell>{children}</AppShell>;
}
