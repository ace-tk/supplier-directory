import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AppShell } from "@/components/layout/app-shell";
import { roleHome } from "@/lib/roles";

export default async function FreelancerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login?from=/freelancer/dashboard");
  }

  if (session.user.role !== "FREELANCER") {
    redirect(roleHome(session.user.role));
  }

  return <AppShell portal="freelancer">{children}</AppShell>;
}
