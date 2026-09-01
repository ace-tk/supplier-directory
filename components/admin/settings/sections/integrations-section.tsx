"use client";

import { AlertCircle, CheckCircle2, Database, Mail, MessageCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface IntegrationsProps {
  integrations: { openai: boolean; database: boolean };
}

export function IntegrationsSection({ integrations }: IntegrationsProps) {
  const rows = [
    {
      icon: Sparkles,
      name: "OpenAI",
      description: "Powers Content, Product description, Mood Board, Repeat Print and AI Garment Studio generation.",
      connected: integrations.openai,
      manageNote: "Configured via the OPENAI_API_KEY environment variable.",
    },
    {
      icon: Database,
      name: "Database",
      description: "Primary Postgres database (hosted on Supabase).",
      connected: integrations.database,
      manageNote: "Configured via the DATABASE_URL environment variable.",
    },
    {
      icon: Mail,
      name: "Email delivery",
      description: "Outbound transactional email (invites, invoices, notifications).",
      connected: false,
      manageNote: "No provider is configured yet — email sends are mocked (logged, not delivered).",
    },
    {
      icon: MessageCircle,
      name: "WhatsApp",
      description: "Outbound WhatsApp messages for proposals and campaigns.",
      connected: false,
      manageNote: "No provider is configured yet — WhatsApp sends are mocked (logged, not delivered).",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Connection status for services SupplyBase depends on. Credentials are environment-managed and are never shown here.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.name} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                  <row.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{row.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{row.description}</p>
                </div>
              </div>
              {row.connected ? (
                <Badge className="gap-1 shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
                  <CheckCircle2 className="h-3 w-3" /> Connected
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1 shrink-0 border-0">
                  <AlertCircle className="h-3 w-3" /> Not configured
                </Badge>
              )}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">{row.manageNote}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
