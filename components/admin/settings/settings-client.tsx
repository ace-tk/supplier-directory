"use client";

import { useState } from "react";
import {
  Building2,
  KeyRound,
  Layers,
  PlugZap,
  Settings as SettingsIcon,
  ShieldCheck,
  ShieldQuestion,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import type { SessionUser } from "@/types/auth";
import type { NotificationPreferenceCategory } from "@/lib/generated/prisma/enums";
import { GeneralSection } from "@/components/admin/settings/sections/general-section";
import { CompanyProfileSection } from "@/components/admin/settings/sections/company-profile-section";
import { TeamAccessSection } from "@/components/admin/settings/sections/team-access-section";
import { RolesPermissionsSection } from "@/components/admin/settings/sections/roles-permissions-section";
import { NotificationsSection } from "@/components/admin/settings/sections/notifications-section";
import { IntegrationsSection } from "@/components/admin/settings/sections/integrations-section";
import { SecuritySection } from "@/components/admin/settings/sections/security-section";
import { DataPrivacySection } from "@/components/admin/settings/sections/data-privacy-section";

export interface WorkspaceSettingsData {
  id: string;
  name: string;
  businessEmail: string | null;
  businessPhone: string | null;
  website: string | null;
  country: string | null;
  timezone: string | null;
  defaultCurrency: string | null;
  dateFormat: string | null;
  logoUrl: string | null;
  legalName: string | null;
  businessType: string | null;
  taxId: string | null;
  registeredAddress: string | null;
  billingAddress: string | null;
  description: string | null;
}

type TeamData = NonNullable<Awaited<ReturnType<typeof import("@/services/team-management").getTeamManagementData>>>;

interface SettingsClientProps {
  user: SessionUser;
  canManageSettings: boolean;
  workspace: WorkspaceSettingsData | null;
  team: TeamData | null;
  notificationPreferences: { category: NotificationPreferenceCategory; inApp: boolean }[];
  integrations: { openai: boolean; database: boolean };
}

const SECTIONS = [
  { id: "general", label: "General", icon: SettingsIcon },
  { id: "company", label: "Company Profile", icon: Building2 },
  { id: "team", label: "Team & Access", icon: Users },
  { id: "roles", label: "Roles & Permissions", icon: ShieldCheck },
  { id: "notifications", label: "Notifications", icon: Layers },
  { id: "integrations", label: "Integrations", icon: PlugZap },
  { id: "security", label: "Security", icon: KeyRound },
  { id: "privacy", label: "Data & Privacy", icon: ShieldQuestion },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function SettingsClient({ user, canManageSettings, workspace, team, notificationPreferences, integrations }: SettingsClientProps) {
  const [section, setSection] = useState<SectionId>("general");

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader title="Settings" description="Manage your workspace, team access, notifications and security." />

      {!canManageSettings && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          You have view-only access to Settings. Ask a workspace Owner to grant Manage workspace settings permission to make changes.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:shrink",
                section === item.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="min-w-0 rounded-2xl border bg-card p-6">
          {section === "general" && <GeneralSection workspace={workspace} canManage={canManageSettings} />}
          {section === "company" && <CompanyProfileSection workspace={workspace} canManage={canManageSettings} />}
          {section === "team" && <TeamAccessSection team={team} />}
          {section === "roles" && <RolesPermissionsSection />}
          {section === "notifications" && <NotificationsSection initialPreferences={notificationPreferences} />}
          {section === "integrations" && <IntegrationsSection integrations={integrations} />}
          {section === "security" && <SecuritySection user={user} />}
          {section === "privacy" && <DataPrivacySection />}
        </div>
      </div>
    </div>
  );
}
