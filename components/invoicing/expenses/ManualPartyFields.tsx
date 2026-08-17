"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Shown only when neither a Buyer nor a Supplier is linked — lets the user
 * record a company/person name without creating a fake Buyer/Supplier row. */
export function ManualPartyFields({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Company / Person Name</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Not linked to a buyer or supplier — enter manually" />
    </div>
  );
}
