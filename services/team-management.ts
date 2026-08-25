"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { hashPassword } from "@/lib/auth";
import { hashToken, preparePasswordResetToken } from "@/lib/password-reset";
import { ALL_TEAM_PERMISSIONS, ROLE_PRESETS, cleanPermissions, type TeamRoleKey } from "@/lib/team-permissions";
import { canReserveWorkspaceSeat, occupiedWorkspaceSeats } from "@/lib/team-seats";
import { activateWorkspaceInvite } from "@/lib/team-invitations";

type Result<T = void> = { success: true; data: T } | { success: false; error: string };
const INVITE_TTL = 24 * 60 * 60 * 1000;

async function adminUser() {
  const user = await getUser();
  return user?.role === "ADMIN" ? user : null;
}

export async function ensureAdminWorkspace() {
  const admin = await adminUser();
  if (!admin) return null;
  const existing = await db.workspaceMember.findFirst({ where: { userId: admin.id, isOwner: true }, include: { workspace: true } });
  if (existing) return existing.workspace;
  const configured = Number(process.env.TEAM_SEAT_LIMIT ?? "10");
  const seatLimit = Number.isInteger(configured) && configured > 0 ? configured : 10;
  return db.workspace.create({ data: {
    name: "SupplyBase Workspace", seatLimit,
    members: { create: { userId: admin.id, roleKey: "OWNER", roleName: "Owner / Admin", department: "Leadership", permissions: ALL_TEAM_PERMISSIONS, isOwner: true } },
  } });
}

export async function getTeamManagementData() {
  const admin = await adminUser();
  if (!admin) return null;
  const workspace = await ensureAdminWorkspace();
  if (!workspace) return null;
  await db.workspaceInvite.updateMany({ where: { workspaceId: workspace.id, status: "PENDING", expiresAt: { lt: new Date() } }, data: { status: "EXPIRED" } });
  const [members, invites] = await Promise.all([
    db.workspaceMember.findMany({ where: { workspaceId: workspace.id, status: { not: "REMOVED" } }, include: { user: { select: { id: true, name: true, email: true, avatar: true } } }, orderBy: [{ isOwner: "desc" }, { joinedAt: "asc" }] }),
    db.workspaceInvite.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const pending = invites.filter((invite) => invite.status === "PENDING");
  const occupied = occupiedWorkspaceSeats(members.filter((member) => member.status === "ACTIVE").length, pending.length);
  return {
    workspace: { id: workspace.id, name: workspace.name, seatLimit: workspace.seatLimit },
    stats: { usedSeats: occupied, availableSeats: Math.max(0, workspace.seatLimit - occupied), pendingInvites: pending.length, activeMembers: members.filter((m) => m.status === "ACTIVE").length },
    members: members.map((m) => ({ ...m, joinedAt: m.joinedAt.toISOString(), updatedAt: m.updatedAt.toISOString(), lastActiveAt: m.lastActiveAt?.toISOString() ?? null })),
    invites: invites.map((i) => ({ ...i, expiresAt: i.expiresAt.toISOString(), createdAt: i.createdAt.toISOString(), acceptedAt: i.acceptedAt?.toISOString() ?? null })),
  };
}

export async function inviteTeamMemberAction(input: { name: string; email: string; roleKey: string; roleName?: string; department?: string; permissions: string[]; message?: string }): Promise<Result<{ token: string; existingUser: boolean }>> {
  const admin = await adminUser();
  if (!admin) return { success: false, error: "Owner access required." };
  const workspace = await ensureAdminWorkspace();
  if (!workspace) return { success: false, error: "Workspace not found." };
  const name = input.name.trim(); const email = input.email.trim().toLowerCase();
  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email)) return { success: false, error: "Enter a valid name and email." };
  const preset = ROLE_PRESETS[input.roleKey as TeamRoleKey];
  if (!preset && !input.roleName?.trim()) return { success: false, error: "Choose a role or enter a custom role name." };
  const [activeSeats, pendingSeats, existingMember, existingUser] = await Promise.all([
    db.workspaceMember.count({ where: { workspaceId: workspace.id, status: "ACTIVE" } }),
    db.workspaceInvite.count({ where: { workspaceId: workspace.id, status: "PENDING", expiresAt: { gt: new Date() } } }),
    db.workspaceMember.findFirst({ where: { workspaceId: workspace.id, user: { email } } }),
    db.user.findUnique({ where: { email } }),
  ]);
  if (existingMember?.status !== "REMOVED") return { success: false, error: "This person is already a workspace member." };
  if (await db.workspaceInvite.findFirst({ where: { workspaceId: workspace.id, email, status: "PENDING", expiresAt: { gt: new Date() } } })) return { success: false, error: "A pending invitation already exists for this email." };
  if (!canReserveWorkspaceSeat(activeSeats, pendingSeats, workspace.seatLimit)) return { success: false, error: `Seat limit reached (${workspace.seatLimit}). Cancel an invite or deactivate a member first.` };
  const permissions = cleanPermissions(input.permissions);
  const roleName = preset?.name ?? input.roleName!.trim();
  const roleKey = preset ? input.roleKey : "CUSTOM";
  const department = input.department?.trim() || preset?.department || null;
  const activation = preparePasswordResetToken();
  let userId = existingUser?.id;
  await db.$transaction(async (tx) => {
    if (!existingUser) {
      const user = await tx.user.create({ data: { name, email, role: "TEAM_MEMBER", password: await hashPassword(crypto.randomBytes(32).toString("hex")) } });
      userId = user.id;
      await tx.passwordResetToken.create({ data: { userId, tokenHash: activation.tokenHash, expiresAt: activation.expiresAt } });
    }
    await tx.workspaceInvite.create({ data: { workspaceId: workspace.id, userId, name, email, roleKey, roleName, department, permissions, message: input.message?.trim() || null, tokenHash: activation.tokenHash, expiresAt: new Date(Date.now() + INVITE_TTL), invitedById: admin.id } });
  });
  revalidatePath("/team");
  return { success: true, data: { token: activation.rawToken, existingUser: Boolean(existingUser) } };
}

export async function acceptExistingInviteAction(rawToken: string): Promise<Result> {
  const user = await getUser();
  if (!user) return { success: false, error: "Sign in with the invited email before accepting." };
  const invite = await db.workspaceInvite.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date()) return { success: false, error: "This invitation is invalid or expired." };
  if (invite.email !== user.email.toLowerCase()) return { success: false, error: "This invitation belongs to a different email address." };
  await activateWorkspaceInvite(invite.id, user.id);
  return { success: true, data: undefined };
}

export async function updateMemberAction(memberId: string, input: { roleKey: string; roleName: string; department?: string; permissions: string[] }): Promise<Result> {
  const admin = await adminUser(); if (!admin) return { success: false, error: "Owner access required." };
  const member = await db.workspaceMember.findUnique({ where: { id: memberId } });
  if (!member) return { success: false, error: "Member not found." };
  if (member.isOwner) return { success: false, error: "Owner role and critical access are protected." };
  await db.workspaceMember.update({ where: { id: memberId }, data: { roleKey: input.roleKey, roleName: input.roleName.trim(), department: input.department?.trim() || null, permissions: cleanPermissions(input.permissions) } });
  revalidatePath("/team"); return { success: true, data: undefined };
}

export async function setMemberStatusAction(memberId: string, active: boolean): Promise<Result> {
  const admin = await adminUser(); if (!admin) return { success: false, error: "Owner access required." };
  const member = await db.workspaceMember.findUnique({ where: { id: memberId }, include: { workspace: true } });
  if (!member) return { success: false, error: "Member not found." };
  if (member.isOwner) return { success: false, error: "Workspace Owner cannot be deactivated." };
  if (active) {
    const used = await db.workspaceMember.count({ where: { workspaceId: member.workspaceId, status: "ACTIVE" } });
    if (used >= member.workspace.seatLimit) return { success: false, error: "No available seat to reactivate this member." };
  }
  await db.workspaceMember.update({ where: { id: memberId }, data: { status: active ? "ACTIVE" : "INACTIVE" } });
  revalidatePath("/team"); return { success: true, data: undefined };
}

export async function removeMemberAction(memberId: string): Promise<Result> {
  const admin = await adminUser(); if (!admin) return { success: false, error: "Owner access required." };
  const member = await db.workspaceMember.findUnique({ where: { id: memberId } });
  if (!member) return { success: false, error: "Member not found." };
  if (member.isOwner) return { success: false, error: "Workspace Owner cannot be removed." };
  await db.workspaceMember.update({ where: { id: memberId }, data: { status: "REMOVED" } });
  revalidatePath("/team"); return { success: true, data: undefined };
}

export async function cancelInviteAction(inviteId: string): Promise<Result> {
  const admin = await adminUser(); if (!admin) return { success: false, error: "Owner access required." };
  const invite = await db.workspaceInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.status !== "PENDING") return { success: false, error: "Pending invitation not found." };
  await db.$transaction([db.workspaceInvite.update({ where: { id: inviteId }, data: { status: "CANCELLED" } }), db.passwordResetToken.updateMany({ where: { tokenHash: invite.tokenHash, usedAt: null }, data: { usedAt: new Date() } })]);
  revalidatePath("/team"); return { success: true, data: undefined };
}

export async function regenerateInviteAction(inviteId: string): Promise<Result<{ token: string; existingUser: boolean }>> {
  const admin = await adminUser(); if (!admin) return { success: false, error: "Owner access required." };
  const invite = await db.workspaceInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.status !== "PENDING") return { success: false, error: "Pending invitation not found." };
  const token = preparePasswordResetToken();
  const user = invite.userId ? await db.user.findUnique({ where: { id: invite.userId } }) : null;
  await db.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({ where: { tokenHash: invite.tokenHash, usedAt: null }, data: { usedAt: new Date() } });
    if (user?.role === "TEAM_MEMBER") await tx.passwordResetToken.create({ data: { userId: user.id, tokenHash: token.tokenHash, expiresAt: token.expiresAt } });
    await tx.workspaceInvite.update({ where: { id: inviteId }, data: { tokenHash: token.tokenHash, expiresAt: token.expiresAt } });
  });
  revalidatePath("/team"); return { success: true, data: { token: token.rawToken, existingUser: user?.role !== "TEAM_MEMBER" } };
}
