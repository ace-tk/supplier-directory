"use client";

import { useState } from "react";
import { Loader2, LogOut, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS } from "@/lib/roles";
import { useAuth } from "@/hooks/use-session";
import { changePasswordAction } from "@/services/settings";
import type { SessionUser } from "@/types/auth";

export function SecuritySection({ user }: { user: SessionUser }) {
  const { logout, isLoggingOut } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) return toast.error("New passwords do not match.");
    setSaving(true);
    const result = await changePasswordAction({ currentPassword, newPassword });
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Password updated");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Security</h2>
        <p className="text-sm text-muted-foreground">Your account credentials and session.</p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Account information</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Full name</Label>
            <Input value={user.name} disabled />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Email address</Label>
            <Input value={user.email} disabled />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Role</Label>
            <Input value={ROLE_LABELS[user.role]} disabled />
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t pt-6">
        <p className="text-sm font-medium">Change password</p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sec-current" className="text-xs font-medium">Current password</Label>
            <Input id="sec-current" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sec-new" className="text-xs font-medium">New password</Label>
            <Input id="sec-new" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sec-confirm" className="text-xs font-medium">Confirm new password</Label>
            <Input id="sec-confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <Button
            className="gap-2"
            onClick={handleChangePassword}
            disabled={saving || !currentPassword || !newPassword || !confirmPassword}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Update password
          </Button>
        </div>
      </div>

      <div className="space-y-3 border-t pt-6">
        <p className="text-sm font-medium">Session</p>
        <Button variant="destructive" className="gap-2" onClick={logout} disabled={isLoggingOut}>
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? "Signing out…" : "Sign out of this device"}
        </Button>
      </div>
    </div>
  );
}
