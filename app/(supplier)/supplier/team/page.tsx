"use client";

import { useState } from "react";
import { UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { RecordsTable, type RecordColumn } from "@/components/portal/records-table";
import { StatusBadge } from "@/components/portal/status-badge";
import { useSession } from "@/hooks/use-session";
import { getTeamMembers, type TeamMemberRecord } from "@/lib/mock-data";
import { initials } from "@/utils/format";

const columns: RecordColumn<TeamMemberRecord>[] = [
  {
    key: "name",
    label: "Name",
    render: (r) => (
      <span className="flex items-center gap-2.5">
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-[11px] font-semibold shrink-0">
          {initials(r.name)}
        </span>
        <span className="font-medium text-foreground">{r.name}</span>
      </span>
    ),
  },
  { key: "email", label: "Email", render: (r) => r.email, className: "text-muted-foreground" },
  { key: "role", label: "Role", render: (r) => r.role },
  { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
];

export default function TeamMembersPage() {
  const session = useSession();
  const [inviting, setInviting] = useState(false);
  const members = getTeamMembers(session?.id ?? "guest", session?.name ?? "You", session?.email ?? "");

  // Mock invite — swap for a real `POST /api/supplier/team/invite` call later.
  async function handleInvite() {
    setInviting(true);
    await new Promise((r) => setTimeout(r, 800));
    setInviting(false);
    toast.success("Invite sent");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Members"
        description="People on your team who can manage this supplier account."
        actions={
          <Button size="sm" className="gap-1.5" onClick={handleInvite} disabled={inviting}>
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Invite member
          </Button>
        }
      />
      <RecordsTable columns={columns} rows={members} />
    </div>
  );
}
