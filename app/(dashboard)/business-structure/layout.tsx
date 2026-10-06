import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";

// Admin only, like the other admin modules. The sidebar hides the link for
// everyone else (see permissionForAdminHref in lib/roles.ts).
export default async function BusinessStructureLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user || user.role !== "ADMIN") redirect("/unauthorized");
  return children;
}
