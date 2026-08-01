"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/use-session";

export default function BuyerSettingsPage() {
  const session = useSession();
  const [name, setName] = useState(session?.name ?? "");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  // Mock save — swap for a real `updateProfileAction` server action later;
  // the form and field names are already shaped for it.
  async function handleSave() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 700));
    setSaving(false);
    toast.success("Profile updated");
  }

  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader title="Settings" description="Manage your account and buyer profile." />

      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-xs font-medium">Full name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium">Email address</Label>
          <Input id="email" value={session?.email ?? ""} disabled />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company" className="text-xs font-medium">Company name</Label>
          <Input id="company" placeholder="Acme Corp" value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-xs font-medium">Phone number</Label>
          <Input id="phone" type="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Button className="gap-2" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}
