"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { SUPPLIER_TYPES } from "@/types/supplier";
import { cn } from "@/lib/utils";

export default function SupplierProfilePage() {
  const session = useSession();
  const [companyName, setCompanyName] = useState("");
  const [supplierType, setSupplierType] = useState<string>("Manufacturer");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("India");
  const [website, setWebsite] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Mock save — swap for a real `updateSupplierProfileAction` later; the
  // form fields already mirror the SupplierListing shape used by the
  // Directory and Shop pages.
  async function handleSave() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    toast.success("Company profile updated");
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Company Profile" description="This is how buyers see your business in the Directory and Shop." />

      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="companyName" className="text-xs font-medium">Company name</Label>
            <Input id="companyName" placeholder="Acme Textiles Pvt. Ltd." value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Supplier type</Label>
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {SUPPLIER_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSupplierType(t)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                    supplierType === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-transparent hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="city" className="text-xs font-medium">City</Label>
            <Input id="city" placeholder="Surat" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="country" className="text-xs font-medium">Country</Label>
            <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="website" className="text-xs font-medium">Website</Label>
            <Input id="website" placeholder="yourcompany.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp" className="text-xs font-medium">WhatsApp number</Label>
            <Input id="whatsapp" type="tel" placeholder="+91 98765 43210" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium">Account email</Label>
          <Input id="email" value={session?.email ?? ""} disabled />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-xs font-medium">Company description</Label>
          <Textarea
            id="description"
            rows={4}
            placeholder="Tell buyers what you make, your certifications, and what makes your business stand out..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <Button className="gap-2" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save profile
        </Button>
      </div>
    </div>
  );
}
