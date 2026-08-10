import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { EditorFormState } from "./types";

export function SellerInfoFields({
  form,
  onChange,
}: {
  form: EditorFormState;
  onChange: (patch: Partial<EditorFormState>) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Seller / Company Information</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Auto-filled from your organization profile. Editable for this invoice only.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Business Name</Label>
          <Input value={form.sellerName} onChange={(e) => onChange({ sellerName: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">GSTIN / Tax ID</Label>
          <Input
            value={form.sellerTaxId}
            onChange={(e) => onChange({ sellerTaxId: e.target.value })}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Email</Label>
          <Input type="email" value={form.sellerEmail} onChange={(e) => onChange({ sellerEmail: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Phone</Label>
          <Input
            value={form.sellerPhone}
            onChange={(e) => onChange({ sellerPhone: e.target.value })}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Address</Label>
        <Textarea
          rows={2}
          value={form.sellerAddress}
          onChange={(e) => onChange({ sellerAddress: e.target.value })}
          placeholder="Optional"
        />
      </div>
    </div>
  );
}
