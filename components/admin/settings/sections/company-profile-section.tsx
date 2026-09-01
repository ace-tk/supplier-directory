"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateCompanyProfileAction } from "@/services/settings";
import type { WorkspaceSettingsData } from "@/components/admin/settings/settings-client";

function initialState(workspace: WorkspaceSettingsData | null) {
  return {
    legalName: workspace?.legalName ?? "",
    businessType: workspace?.businessType ?? "",
    taxId: workspace?.taxId ?? "",
    registeredAddress: workspace?.registeredAddress ?? "",
    billingAddress: workspace?.billingAddress ?? "",
    description: workspace?.description ?? "",
  };
}

export function CompanyProfileSection({ workspace, canManage }: { workspace: WorkspaceSettingsData | null; canManage: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState(initialState(workspace));
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initialState(workspace));

  async function handleSave() {
    setSaving(true);
    const result = await updateCompanyProfileAction(form);
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Company profile saved");
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Company Profile</h2>
        <p className="text-sm text-muted-foreground">
          Legal and registration details. Contact details (email, phone, website) live under General.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cp-legal" className="text-xs font-medium">Legal / registered business name</Label>
          <Input id="cp-legal" value={form.legalName} disabled={!canManage} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cp-type" className="text-xs font-medium">Business type</Label>
          <Input id="cp-type" placeholder="e.g. Private Limited, Partnership" value={form.businessType} disabled={!canManage} onChange={(e) => setForm({ ...form, businessType: e.target.value })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cp-tax" className="text-xs font-medium">GST / VAT / Tax ID</Label>
          <Input id="cp-tax" value={form.taxId} disabled={!canManage} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cp-reg-address" className="text-xs font-medium">Registered address</Label>
          <Textarea id="cp-reg-address" rows={2} value={form.registeredAddress} disabled={!canManage} onChange={(e) => setForm({ ...form, registeredAddress: e.target.value })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cp-bill-address" className="text-xs font-medium">Billing address</Label>
          <Textarea id="cp-bill-address" rows={2} value={form.billingAddress} disabled={!canManage} onChange={(e) => setForm({ ...form, billingAddress: e.target.value })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cp-desc" className="text-xs font-medium">Company description</Label>
          <Textarea id="cp-desc" rows={3} value={form.description} disabled={!canManage} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
      </div>

      {canManage && (
        <div className="flex items-center gap-2 pt-2">
          <Button className="gap-2" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </Button>
          <Button variant="outline" onClick={() => setForm(initialState(workspace))} disabled={saving || !dirty}>Cancel</Button>
        </div>
      )}
    </div>
  );
}
