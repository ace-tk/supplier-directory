import { db } from "@/lib/db";

export async function activateWorkspaceInvite(inviteId: string, userId: string) {
  const invite = await db.workspaceInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date() || invite.userId !== userId) return false;
  const [active, workspace] = await Promise.all([
    db.workspaceMember.count({ where: { workspaceId: invite.workspaceId, status: "ACTIVE" } }),
    db.workspace.findUnique({ where: { id: invite.workspaceId } }),
  ]);
  if (!workspace || active >= workspace.seatLimit) return false;
  await db.$transaction([
    db.workspaceMember.upsert({ where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId } }, create: { workspaceId: invite.workspaceId, userId, roleKey: invite.roleKey, roleName: invite.roleName, department: invite.department, permissions: invite.permissions }, update: { roleKey: invite.roleKey, roleName: invite.roleName, department: invite.department, permissions: invite.permissions, status: "ACTIVE" } }),
    db.workspaceInvite.update({ where: { id: invite.id }, data: { status: "ACCEPTED", acceptedAt: new Date(), userId } }),
  ]);
  return true;
}
