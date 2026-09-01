"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { validateImage } from "@/lib/file-validation";
import { updateGeneralSettingsAction } from "@/services/settings";
import type { WorkspaceSettingsData } from "@/components/admin/settings/settings-client";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "CNY"];
const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];

function initialState(workspace: WorkspaceSettingsData | null) {
  return {
    name: workspace?.name ?? "",
    businessEmail: workspace?.businessEmail ?? "",
    businessPhone: workspace?.businessPhone ?? "",
    website: workspace?.website ?? "",
    country: workspace?.country ?? "",
    timezone: workspace?.timezone ?? "",
    defaultCurrency: workspace?.defaultCurrency ?? "",
    dateFormat: workspace?.dateFormat ?? "",
    logoUrl: workspace?.logoUrl ?? "",
  };
}

export function GeneralSection({ workspace, canManage }: { workspace: WorkspaceSettingsData | null; canManage: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState(initialState(workspace));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(initialState(workspace));

  async function handleLogoChange(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const validation = validateImage(file.type, file.size, file.name);
      if (!validation.valid) {
        toast.error(validation.error);
        return;
      }
      const dataUrl = await fileToDataUrl(file);
      setForm((prev) => ({ ...prev, logoUrl: dataUrl }));
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    const result = await updateGeneralSettingsAction(form);
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    toast.success("General settings saved");
    router.refresh();
  }

  function handleCancel() {
    setForm(initialState(workspace));
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">General</h2>
        <p className="text-sm text-muted-foreground">Workspace identity and regional defaults used across SupplyBase.</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Logo</Label>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
            {form.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logoUrl} alt="Workspace logo" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-muted-foreground">No logo</span>
            )}
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted/60">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload logo
            <input type="file" accept="image/*" className="hidden" disabled={!canManage || uploading} onChange={(e) => handleLogoChange(e.target.files?.[0])} />
          </label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ws-name" className="text-xs font-medium">Workspace / company display name</Label>
          <Input id="ws-name" value={form.name} disabled={!canManage} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ws-email" className="text-xs font-medium">Business email</Label>
          <Input id="ws-email" type="email" value={form.businessEmail} disabled={!canManage} onChange={(e) => setForm({ ...form, businessEmail: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ws-phone" className="text-xs font-medium">Business phone</Label>
          <Input id="ws-phone" type="tel" value={form.businessPhone} disabled={!canManage} onChange={(e) => setForm({ ...form, businessPhone: e.target.value })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ws-website" className="text-xs font-medium">Website</Label>
          <Input id="ws-website" placeholder="https://" value={form.website} disabled={!canManage} onChange={(e) => setForm({ ...form, website: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ws-country" className="text-xs font-medium">Country</Label>
          <Input id="ws-country" value={form.country} disabled={!canManage} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ws-timezone" className="text-xs font-medium">Timezone</Label>
          <Input id="ws-timezone" placeholder="e.g. Asia/Kolkata" value={form.timezone} disabled={!canManage} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Default currency</Label>
          <Select value={form.defaultCurrency || undefined} onValueChange={(v) => v && setForm({ ...form, defaultCurrency: v })}>
            <SelectTrigger className="w-full" disabled={!canManage}>
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Date format</Label>
          <Select value={form.dateFormat || undefined} onValueChange={(v) => v && setForm({ ...form, dateFormat: v })}>
            <SelectTrigger className="w-full" disabled={!canManage}>
              <SelectValue placeholder="Select format" />
            </SelectTrigger>
            <SelectContent>
              {DATE_FORMATS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {canManage && (
        <div className="flex items-center gap-2 pt-2">
          <Button className="gap-2" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </Button>
          <Button variant="outline" onClick={handleCancel} disabled={saving || !dirty}>Cancel</Button>
        </div>
      )}
    </div>
  );
}
