"use client";

import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PERMISSION_GROUPS, ROLE_PRESETS } from "@/lib/team-permissions";

const roleEntries = Object.entries(ROLE_PRESETS) as [string, (typeof ROLE_PRESETS)[keyof typeof ROLE_PRESETS]][];

export function RolesPermissionsSection() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Roles & Permissions</h2>
          <p className="text-sm text-muted-foreground">
            Role presets and the permission groups they draw from. Assigning a role or editing a member&apos;s access happens in Team Management.
          </p>
        </div>
        <Button variant="outline" className="gap-2 shrink-0" render={<Link href="/team" />} nativeButton={false}>
          Manage in Team Management <ArrowUpRight className="h-4 w-4" />
        </Button>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role presets</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {roleEntries.map(([key, role]) => (
            <div key={key} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-medium">{role.name}</h3>
                  <p className="text-xs text-muted-foreground">{role.department}</p>
                </div>
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {role.permissions.slice(0, 4).map((permission) => (
                  <Badge variant="secondary" key={permission} className="font-normal text-[11px]">{permission.split(".").join(" · ")}</Badge>
                ))}
                {role.permissions.length > 4 && <Badge variant="outline" className="text-[11px]">+{role.permissions.length - 4}</Badge>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Available module permissions</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.label} className="rounded-xl border p-4">
              <p className="text-sm font-medium">{group.label}</p>
              <ul className="mt-2 space-y-1">
                {group.permissions.map(([key, label]) => (
                  <li key={key} className="text-xs text-muted-foreground">{label}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
