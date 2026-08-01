import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AppShell } from "@/components/layout/app-shell";
import { roleHome } from "@/lib/roles";

export default async function BuyerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login?from=/buyer");
  }

  if (session.user.role !== "BUYER") {
    redirect(roleHome(session.user.role));
  }

  return <AppShell portal="buyer">{children}</AppShell>;
}
