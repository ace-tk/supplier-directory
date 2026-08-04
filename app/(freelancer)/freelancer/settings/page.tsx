"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "@/hooks/use-session";
import { getOwnProfileAction, updateProfileAction } from "@/services/freelancer";
import type { FreelancerAvailability } from "@/types/freelancer-portal";

export default function FreelancerSettingsPage() {
  const session = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [availability, setAvailability] = useState<FreelancerAvailability>("AVAILABLE");

  useEffect(() => {
    getOwnProfileAction().then((result) => {
      if (result.success) {
        setLocation(result.data.location ?? "");
        setPhone(result.data.phone ?? "");
        setAvailability(result.data.availability);
      }
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    const result = await updateProfileAction({ location, phone, availability });
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Settings updated");
  }

  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader title="Settings" description="Manage your account and availability." />

      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-xs font-medium">Full name</Label>
          <Input id="name" value={session?.name ?? ""} disabled />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium">Email address</Label>
          <Input id="email" value={session?.email ?? ""} disabled />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location" className="text-xs font-medium">Location</Label>
          <Input id="location" placeholder="City, Country" value={location} disabled={loading} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-xs font-medium">Phone number</Label>
          <Input id="phone" type="tel" placeholder="+91 98765 43210" value={phone} disabled={loading} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Availability</Label>
          <Select value={availability} onValueChange={(v) => v && setAvailability(v as FreelancerAvailability)}>
            <SelectTrigger className="w-full" disabled={loading}>
              <SelectValue placeholder="Select availability" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AVAILABLE">Available</SelectItem>
              <SelectItem value="BUSY">Busy</SelectItem>
              <SelectItem value="UNAVAILABLE">Unavailable</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button className="gap-2" onClick={handleSave} disabled={saving || loading}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}
