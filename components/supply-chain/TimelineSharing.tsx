"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { initialsFor, avatarColorFor } from "@/lib/supply-chain-ui";
import { SHARE_ROLE_LABELS } from "@/lib/supply-chain-permissions";
import { getShareableUsersAction, shareSupplyChainAction, unshareSupplyChainAction, type ShareableUser } from "@/services/supply-chain-sharing";
import type { ShareEntry, ShareRole } from "@/types/supply-chain";

const ROLE_OPTIONS: ShareRole[] = ["TEAM_EDIT", "TEAM_VIEW", "BUYER_VIEW", "BUYER_COMMENT", "SUPPLIER_VIEW", "SUPPLIER_UPDATE"];

interface TimelineSharingProps {
  chainId: string;
  shares: ShareEntry[];
  canShare: boolean;
  onSharesChange: (shares: ShareEntry[]) => void;
}

export function TimelineSharing({ chainId, shares, canShare, onSharesChange }: TimelineSharingProps) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<ShareableUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<ShareRole>("TEAM_VIEW");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) getShareableUsersAction().then(setUsers);
  }, [open]);

  const availableUsers = users.filter((u) => !shares.some((s) => s.user.id === u.id));

  async function handleShare() {
    if (!selectedUserId) {
      toast.error("Select someone to share with.");
      return;
    }
    setSubmitting(true);
    const result = await shareSupplyChainAction(chainId, selectedUserId, selectedRole);
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    const user = users.find((u) => u.id === selectedUserId);
    if (user) {
      onSharesChange([
        ...shares,
        {
          id: `${chainId}-${user.id}`,
          role: selectedRole,
          user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: null, companyName: user.companyName },
          sharedBy: { id: "", name: "You", email: "", role: "ADMIN", avatar: null, companyName: null },
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    setSelectedUserId("");
    toast.success("Shared successfully");
  }

  async function handleUnshare(userId: string) {
    const result = await unshareSupplyChainAction(chainId, userId);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    onSharesChange(shares.filter((s) => s.user.id !== userId));
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Share2 className="h-3.5 w-3.5" /> Share
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-primary" /> Share Supply Chain
            </DialogTitle>
            <DialogDescription>Give team members, buyers, or suppliers access to this workspace.</DialogDescription>
          </DialogHeader>

          {canShare && (
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Select value={selectedUserId} onValueChange={(v) => v && setSelectedUserId(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a person" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} {u.companyName && `— ${u.companyName}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Select value={selectedRole} onValueChange={(v) => v && setSelectedRole(v as ShareRole)}>
                <SelectTrigger className="w-40 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {SHARE_ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleShare} disabled={submitting} className="shrink-0">
                Share
              </Button>
            </div>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {shares.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Not shared with anyone yet.</p>}
            {shares.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2">
                <Avatar size="sm">
                  <AvatarFallback className={cn("text-white text-[9px] font-semibold", avatarColorFor(s.user.id))}>
                    {initialsFor(s.user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">{s.user.name}</p>
                  <p className="text-[10px] text-muted-foreground">{SHARE_ROLE_LABELS[s.role]}</p>
                </div>
                {canShare && (
                  <button
                    type="button"
                    onClick={() => handleUnshare(s.user.id)}
                    className="p-1 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
                    aria-label={`Remove ${s.user.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
