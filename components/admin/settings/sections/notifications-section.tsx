"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setNotificationPreferenceAction } from "@/services/settings";
import type { NotificationPreferenceCategory } from "@/lib/generated/prisma/enums";

const CATEGORY_LABELS: Record<NotificationPreferenceCategory, { label: string; description: string }> = {
  CRM_MESSAGES: { label: "CRM messages", description: "New messages and notes on your CRM conversations." },
  TASK_ASSIGNMENTS: { label: "Task assignments", description: "When a task is assigned to you." },
  PROJECT_UPDATES: { label: "Project updates", description: "Milestones, comments and activity on your projects." },
  INVOICE_UPDATES: { label: "Invoice updates", description: "Invoice status changes and payments recorded." },
  ORDER_UPDATES: { label: "Order updates", description: "Order status changes from suppliers or buyers." },
  SUPPLIER_ACTIVITY: { label: "Supplier activity", description: "New supplier activity relevant to you." },
  BUYER_ACTIVITY: { label: "Buyer activity", description: "New buyer leads and requirement activity." },
  CAMPAIGN_ACTIVITY: { label: "Campaign activity", description: "Marketing campaign status and scheduling." },
  TEAM_INVITATIONS: { label: "Team invitations", description: "Invitations sent or accepted in your workspace." },
  AI_DESIGN_COMPLETION: { label: "AI / design completion", description: "When an AI Garment Studio or Repeat Print generation finishes." },
};

interface Preference {
  category: NotificationPreferenceCategory;
  inApp: boolean;
}

export function NotificationsSection({ initialPreferences }: { initialPreferences: Preference[] }) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [pendingCategory, setPendingCategory] = useState<NotificationPreferenceCategory | null>(null);
  const [, startTransition] = useTransition();

  function toggle(category: NotificationPreferenceCategory, next: boolean) {
    setPreferences((prev) => prev.map((p) => (p.category === category ? { ...p, inApp: next } : p)));
    setPendingCategory(category);
    startTransition(async () => {
      const result = await setNotificationPreferenceAction(category, next);
      setPendingCategory(null);
      if (!result.success) {
        setPreferences((prev) => prev.map((p) => (p.category === category ? { ...p, inApp: !next } : p)));
        toast.error(result.error);
        return;
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          In-app notifications for events across SupplyBase. Email and WhatsApp delivery aren&apos;t connected to a provider yet, so those channels aren&apos;t shown here.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border">
        {preferences.map((pref) => {
          const meta = CATEGORY_LABELS[pref.category];
          const busy = pendingCategory === pref.category;
          return (
            <div key={pref.category} className="flex items-center justify-between gap-4 border-b px-4 py-3.5 last:border-b-0">
              <div className="min-w-0">
                <p className="text-sm font-medium">{meta.label}</p>
                <p className="text-xs text-muted-foreground">{meta.description}</p>
              </div>
              <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>In-app</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={pref.inApp}
                  disabled={busy}
                  onChange={(e) => toggle(pref.category, e.target.checked)}
                  aria-label={`${meta.label} in-app notifications`}
                />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
