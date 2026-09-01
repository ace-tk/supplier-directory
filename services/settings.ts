"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth";
import { requireTeamPermission } from "@/lib/team-auth";
import { ensureAdminWorkspace } from "@/services/team-management";
import type { NotificationPreferenceCategory } from "@/lib/generated/prisma/enums";

type Result<T = void> = { success: true; data: T } | { success: false; error: string };

export interface GeneralSettingsInput {
  name: string;
  businessEmail?: string;
  businessPhone?: string;
  website?: string;
  country?: string;
  timezone?: string;
  defaultCurrency?: string;
  dateFormat?: string;
  logoUrl?: string;
}

export async function updateGeneralSettingsAction(input: GeneralSettingsInput): Promise<Result> {
  const access = await requireGuard();
  if (!access.ok) return access.error;

  const name = input.name.trim();
  if (name.length < 2) return { success: false, error: "Workspace name must be at least 2 characters." };
  if (input.businessEmail && !/^\S+@\S+\.\S+$/.test(input.businessEmail.trim())) {
    return { success: false, error: "Enter a valid business email." };
  }

  await db.workspace.update({
    where: { id: access.workspaceId },
    data: {
      name,
      businessEmail: input.businessEmail?.trim() || null,
      businessPhone: input.businessPhone?.trim() || null,
      website: input.website?.trim() || null,
      country: input.country?.trim() || null,
      timezone: input.timezone?.trim() || null,
      defaultCurrency: input.defaultCurrency?.trim() || null,
      dateFormat: input.dateFormat?.trim() || null,
      logoUrl: input.logoUrl || null,
    },
  });
  revalidatePath("/settings");
  return { success: true, data: undefined };
}

export interface CompanyProfileInput {
  legalName?: string;
  businessType?: string;
  taxId?: string;
  registeredAddress?: string;
  billingAddress?: string;
  description?: string;
}

export async function updateCompanyProfileAction(input: CompanyProfileInput): Promise<Result> {
  const access = await requireGuard();
  if (!access.ok) return access.error;

  await db.workspace.update({
    where: { id: access.workspaceId },
    data: {
      legalName: input.legalName?.trim() || null,
      businessType: input.businessType?.trim() || null,
      taxId: input.taxId?.trim() || null,
      registeredAddress: input.registeredAddress?.trim() || null,
      billingAddress: input.billingAddress?.trim() || null,
      description: input.description?.trim() || null,
    },
  });
  revalidatePath("/settings");
  return { success: true, data: undefined };
}

export async function setNotificationPreferenceAction(category: NotificationPreferenceCategory, inApp: boolean): Promise<Result> {
  const user = await getUser();
  if (!user) return { success: false, error: "Sign in required." };

  await db.notificationPreference.upsert({
    where: { userId_category: { userId: user.id, category } },
    create: { userId: user.id, category, inApp },
    update: { inApp },
  });
  revalidatePath("/settings");
  return { success: true, data: undefined };
}

export async function changePasswordAction(input: { currentPassword: string; newPassword: string }): Promise<Result> {
  const user = await getUser();
  if (!user) return { success: false, error: "Sign in required." };

  const record = await db.user.findUnique({ where: { id: user.id }, select: { password: true } });
  if (!record || !(await verifyPassword(input.currentPassword, record.password))) {
    return { success: false, error: "Current password is incorrect." };
  }
  const strengthError = validatePasswordStrength(input.newPassword);
  if (strengthError) return { success: false, error: strengthError };

  await db.user.update({ where: { id: user.id }, data: { password: await hashPassword(input.newPassword) } });
  return { success: true, data: undefined };
}

export async function exportMyDataAction(): Promise<Result<{ json: string }>> {
  const user = await getUser();
  if (!user) return { success: false, error: "Sign in required." };

  const [profile, membership, supportRequests] = await Promise.all([
    db.user.findUnique({ where: { id: user.id }, select: { id: true, name: true, email: true, role: true, createdAt: true } }),
    db.workspaceMember.findFirst({ where: { userId: user.id, status: "ACTIVE" }, include: { workspace: { select: { name: true } } } }),
    db.supportRequest.findMany({ where: { userId: user.id }, select: { id: true, type: true, subject: true, category: true, priority: true, status: true, createdAt: true } }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    profile,
    workspace: membership ? { name: membership.workspace.name, roleName: membership.roleName, department: membership.department, joinedAt: membership.joinedAt } : null,
    supportRequests,
  };
  return { success: true, data: { json: JSON.stringify(payload, null, 2) } };
}

// ---------------------------------------------------------------------------
// Shared guard: only an ADMIN or a workspace member with settings.manage can
// mutate Settings. Reuses the same permission model Team Management already
// enforces — no second authorization system.
// ---------------------------------------------------------------------------
async function requireGuard(): Promise<{ ok: true; workspaceId: string } | { ok: false; error: Result<never> }> {
  let access;
  try {
    access = await requireTeamPermission("settings.manage");
  } catch {
    return { ok: false, error: { success: false, error: "You don't have permission to manage workspace settings." } };
  }
  // ADMIN's access record carries no workspaceId (it bypasses membership
  // lookups entirely) — ensureAdminWorkspace() is what actually resolves
  // (and lazily creates) the one workspace an ADMIN owns.
  if (access.workspaceId) return { ok: true, workspaceId: access.workspaceId };
  const workspace = await ensureAdminWorkspace();
  if (!workspace) return { ok: false, error: { success: false, error: "Workspace not found." } };
  return { ok: true, workspaceId: workspace.id };
}
