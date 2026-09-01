"use client";

import Link from "next/link";
import { ArrowUpRight, Mail, UserCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type TeamData = NonNullable<Awaited<ReturnType<typeof import("@/services/team-management").getTeamManagementData>>>;

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function TeamAccessSection({ team }: { team: TeamData | null }) {
  if (!team) {
    return (
      <div className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Team & Access</h2>
        <p className="text-sm text-muted-foreground">No workspace found yet. Visit Team Management to set one up.</p>
        <Button className="gap-2 mt-2" render={<Link href="/team" />} nativeButton={false}>
          Open Team Management <ArrowUpRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Team & Access</h2>
          <p className="text-sm text-muted-foreground">
            A summary of who has access to this workspace. Invitations, role changes and removals happen in Team Management.
          </p>
        </div>
        <Button variant="outline" className="gap-2 shrink-0" render={<Link href="/team" />} nativeButton={false}>
          Open Team Management <ArrowUpRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Users} label="Seats used" value={`${team.stats.usedSeats} / ${team.workspace.seatLimit}`} />
        <Stat icon={UserCheck} label="Active members" value={team.stats.activeMembers} />
        <Stat icon={Mail} label="Pending invites" value={team.stats.pendingInvites} />
      </div>

      <div className="overflow-hidden rounded-xl border">
        <div className="hidden grid-cols-[minmax(200px,1.3fr)_1fr_100px] gap-4 border-b bg-muted/40 px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:grid">
          <span>Member</span>
          <span>Role</span>
          <span>Status</span>
        </div>
        {team.members.slice(0, 8).map((member) => (
          <div key={member.id} className="grid grid-cols-[minmax(200px,1.3fr)_1fr_100px] items-center gap-4 border-b px-4 py-3 last:border-b-0">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initials(member.user.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{member.user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
              </div>
            </div>
            <p className="text-sm">{member.roleName}</p>
            <Badge variant={member.status === "ACTIVE" ? "default" : "secondary"} className="w-fit">
              {member.status === "ACTIVE" ? "Active" : "Inactive"}
            </Badge>
          </div>
        ))}
        {!team.members.length && (
          <div className="p-8 text-center text-sm text-muted-foreground">No members yet.</div>
        )}
      </div>
      {team.members.length > 8 && (
        <p className="text-xs text-muted-foreground">
          Showing 8 of {team.members.length} members. <Link href="/team" className="text-primary hover:underline">View all in Team Management</Link>.
        </p>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="rounded-lg bg-primary/10 p-1.5"><Icon className="h-4 w-4 text-primary" /></div>
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
