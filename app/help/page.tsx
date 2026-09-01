import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { getCurrentWorkspaceAccess } from "@/lib/team-auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { portalForRole } from "@/lib/roles";
import { HelpClient } from "@/components/help/help-client";
import packageJson from "@/package.json";

export default async function HelpPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const access = await getCurrentWorkspaceAccess();
  const canSeeAll = Boolean(access?.isOwner || user.role === "ADMIN");

  const [myRequests, allRequests, workspace] = await Promise.all([
    db.supportRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    canSeeAll
      ? db.supportRequest.findMany({ orderBy: { createdAt: "desc" }, include: { user: { select: { name: true, email: true } } } })
      : Promise.resolve([]),
    access?.workspaceId ? db.workspace.findUnique({ where: { id: access.workspaceId }, select: { name: true } }) : Promise.resolve(null),
  ]);

  return (
    <AppShell portal={portalForRole(user.role)}>
      <HelpClient
        user={user}
        myRequests={myRequests.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() }))}
        allRequests={canSeeAll ? allRequests.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })) : null}
        systemInfo={{ appVersion: packageJson.version, workspaceName: workspace?.name ?? null }}
      />
    </AppShell>
  );
}
