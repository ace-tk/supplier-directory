import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AppShell } from "@/components/layout/app-shell";
import { roleHome } from "@/lib/roles";

export default async function SupplierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login?from=/supplier");
  }

  if (session.user.role !== "SUPPLIER") {
    redirect(roleHome(session.user.role));
  }

  return <AppShell portal="supplier">{children}</AppShell>;
}
