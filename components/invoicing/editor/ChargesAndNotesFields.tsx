import { Plus, X } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TAX_MODE_LABELS, TAX_BREAKUP_LABELS } from "@/lib/invoicing/ui";
import { emptyCharge, type EditorFormState, type EditorChargeState } from "./types";
import type { InvoiceTaxMode, InvoiceTaxBreakup, ChargeType } from "@/types/invoicing";

export function ChargesAndNotesFields({
  form,
  onChange,
}: {
  form: EditorFormState;
  onChange: (patch: Partial<EditorFormState>) => void;
}) {
  function updateCharge(key: string, patch: Partial<EditorChargeState>) {
    onChange({ additionalCharges: form.additionalCharges.map((c) => (c.key === key ? { ...c, ...patch } : c)) });
  }
  function removeCharge(key: string) {
    onChange({ additionalCharges: form.additionalCharges.filter((c) => c.key !== key) });
  }
  return (
    <Accordion multiple defaultValue={[]}>
      <AccordionItem value="tax">
        <AccordionTrigger>Tax Configuration</AccordionTrigger>
        <AccordionPanel>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Pricing</Label>
              <Select value={form.taxMode} onValueChange={(v) => v && onChange({ taxMode: v as InvoiceTaxMode })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TAX_MODE_LABELS) as InvoiceTaxMode[]).map((v) => (
                    <SelectItem key={v} value={v}>
                      {TAX_MODE_LABELS[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">GST Breakup</Label>
              <Select
                value={form.taxBreakup}
                onValueChange={(v) => v && onChange({ taxBreakup: v as InvoiceTaxBreakup })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TAX_BREAKUP_LABELS) as InvoiceTaxBreakup[]).map((v) => (
                    <SelectItem key={v} value={v}>
                      {TAX_BREAKUP_LABELS[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2.5">
            Tax mode and breakup are set explicitly per invoice — they are never guessed automatically.
          </p>
        </AccordionPanel>
      </AccordionItem>

      <AccordionItem value="charges">
        <AccordionTrigger>Shipping & Additional Charges</AccordionTrigger>
        <AccordionPanel className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Shipping Charges</Label>
            <div className="flex gap-2">
              <Select value={form.shippingType} onValueChange={(v) => v && onChange({ shippingType: v as ChargeType })}>
                <SelectTrigger className="w-36 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED">Fixed Amount</SelectItem>
                  <SelectItem value="PERCENT">Percentage</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={0}
                step="any"
                value={form.shippingValue}
                onChange={(e) => onChange({ shippingValue: e.target.value })}
                className="flex-1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Additional Charges</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => onChange({ additionalCharges: [...form.additionalCharges, emptyCharge()] })}
              >
                <Plus className="h-3 w-3" /> Add Additional Charge
              </Button>
            </div>
            {form.additionalCharges.length > 0 && (
              <div className="space-y-2">
                {form.additionalCharges.map((c) => (
                  <div key={c.key} className="flex gap-2 items-center">
                    <Input
                      placeholder="Charge name"
                      value={c.name}
                      onChange={(e) => updateCharge(c.key, { name: e.target.value })}
                      className="flex-1"
                    />
                    <Select value={c.type} onValueChange={(v) => v && updateCharge(c.key, { type: v as ChargeType })}>
                      <SelectTrigger className="w-28 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FIXED">Fixed</SelectItem>
                        <SelectItem value="PERCENT">Percent</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={c.value}
                      onChange={(e) => updateCharge(c.key, { value: e.target.value })}
                      className="w-24 shrink-0"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeCharge(c.key)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Additional Discount</Label>
            <Input
              type="number"
              min={0}
              step="any"
              value={form.additionalDiscount}
              onChange={(e) => onChange({ additionalDiscount: e.target.value })}
            />
          </div>
        </AccordionPanel>
      </AccordionItem>

      <AccordionItem value="notes">
        <AccordionTrigger>Notes & Terms</AccordionTrigger>
        <AccordionPanel>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Customer Notes</Label>
              <Textarea
                rows={2}
                value={form.customerNotes}
                onChange={(e) => onChange({ customerNotes: e.target.value })}
                placeholder="Optional notes visible on the invoice"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Terms & Conditions</Label>
              <Textarea
                rows={2}
                value={form.termsAndConditions}
                onChange={(e) => onChange({ termsAndConditions: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  );
}
