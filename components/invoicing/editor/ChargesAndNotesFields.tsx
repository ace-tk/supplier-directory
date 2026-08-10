import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TAX_MODE_LABELS, TAX_BREAKUP_LABELS } from "@/lib/invoicing/ui";
import type { EditorFormState } from "./types";
import type { InvoiceTaxMode, InvoiceTaxBreakup } from "@/types/invoicing";

export function ChargesAndNotesFields({
  form,
  onChange,
}: {
  form: EditorFormState;
  onChange: (patch: Partial<EditorFormState>) => void;
}) {
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
        <AccordionPanel>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Shipping Cost</Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={form.shippingCharge}
                onChange={(e) => onChange({ shippingCharge: e.target.value })}
              />
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
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Miscellaneous Charges</Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={form.miscCharge}
                onChange={(e) => onChange({ miscCharge: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Misc. Charges Description</Label>
              <Input
                value={form.miscChargeLabel}
                onChange={(e) => onChange({ miscChargeLabel: e.target.value })}
                placeholder="e.g. Packaging Charges"
              />
            </div>
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
