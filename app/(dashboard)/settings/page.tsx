import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { getCurrentWorkspaceAccess } from "@/lib/team-auth";
import { ensureAdminWorkspace, getTeamManagementData } from "@/services/team-management";
import { db } from "@/lib/db";
import { SettingsClient } from "@/components/admin/settings/settings-client";
import type { NotificationPreferenceCategory } from "@/lib/generated/prisma/enums";

const NOTIFICATION_CATEGORIES: NotificationPreferenceCategory[] = [
  "CRM_MESSAGES",
  "TASK_ASSIGNMENTS",
  "PROJECT_UPDATES",
  "INVOICE_UPDATES",
  "ORDER_UPDATES",
  "SUPPLIER_ACTIVITY",
  "BUYER_ACTIVITY",
  "CAMPAIGN_ACTIVITY",
  "TEAM_INVITATIONS",
  "AI_DESIGN_COMPLETION",
];

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const [access, team] = await Promise.all([getCurrentWorkspaceAccess(), getTeamManagementData()]);

  // Workspace record: resolve the same way services/settings.ts does, so the
  // page always shows the workspace mutations will actually target.
  const workspace = access?.workspaceId
    ? await db.workspace.findUnique({ where: { id: access.workspaceId } })
    : await ensureAdminWorkspace();

  const canManageSettings = Boolean(access && (access.permissions.includes("*") || access.permissions.includes("settings.manage")));

  const preferenceRows = await db.notificationPreference.findMany({ where: { userId: user.id } });
  const preferenceMap = new Map(preferenceRows.map((row) => [row.category, row.inApp]));
  const notificationPreferences = NOTIFICATION_CATEGORIES.map((category) => ({
    category,
    inApp: preferenceMap.get(category) ?? true,
  }));

  const integrations = {
    openai: Boolean(process.env.OPENAI_API_KEY),
    database: Boolean(process.env.DATABASE_URL),
  };

  return (
    <SettingsClient
      user={user}
      canManageSettings={canManageSettings}
      workspace={workspace ? {
        id: workspace.id,
        name: workspace.name,
        businessEmail: workspace.businessEmail,
        businessPhone: workspace.businessPhone,
        website: workspace.website,
        country: workspace.country,
        timezone: workspace.timezone,
        defaultCurrency: workspace.defaultCurrency,
        dateFormat: workspace.dateFormat,
        logoUrl: workspace.logoUrl,
        legalName: workspace.legalName,
        businessType: workspace.businessType,
        taxId: workspace.taxId,
        registeredAddress: workspace.registeredAddress,
        billingAddress: workspace.billingAddress,
        description: workspace.description,
      } : null}
      team={team}
      notificationPreferences={notificationPreferences}
      integrations={integrations}
    />
  );
}
