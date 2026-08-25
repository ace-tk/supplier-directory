import { cache } from "react";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import type { TeamPermission } from "@/lib/team-permissions";

export const getCurrentWorkspaceAccess = cache(async () => {
  const user = await getUser();
  if (!user) return null;
  if (user.role === "ADMIN") {
    return { user, isOwner: true, permissions: ["*"] as string[], membershipId: null, workspaceId: null };
  }
  const membership = await db.workspaceMember.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    select: { id: true, workspaceId: true, isOwner: true, permissions: true },
  });
  return membership ? { user, membershipId: membership.id, workspaceId: membership.workspaceId, isOwner: membership.isOwner, permissions: membership.permissions } : null;
});

export async function hasTeamPermission(permission: TeamPermission) {
  const access = await getCurrentWorkspaceAccess();
  return Boolean(access && (access.permissions.includes("*") || access.permissions.includes(permission)));
}

export async function requireTeamPermission(permission: TeamPermission) {
  const access = await getCurrentWorkspaceAccess();
  if (!access || (!access.permissions.includes("*") && !access.permissions.includes(permission))) throw new Error("FORBIDDEN");
  return access;
}
