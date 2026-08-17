"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InvoiceTemplateRenderer } from "@/components/invoicing/templates/InvoiceTemplateRenderer";
import { buildExpenseVoucherPreviewProps } from "@/lib/expenses/voucher-preview";
import { cn } from "@/lib/utils";
import type { ExpenseCategory } from "@/types/expense";
import type { InvoiceTemplate } from "@/types/invoicing";

const TEMPLATES: { value: InvoiceTemplate; label: string; swatch: string }[] = [
  { value: "REGULAR", label: "Regular", swatch: "bg-primary" },
  { value: "CLASSIC_RED", label: "Classic Red", swatch: "bg-red-600" },
  { value: "MINIMAL_STUDIO", label: "Minimal Studio", swatch: "bg-zinc-800" },
];

export function VoucherSection({
  createVoucher,
  voucherTemplate,
  onChange,
  previewInput,
}: {
  createVoucher: boolean;
  voucherTemplate: InvoiceTemplate | null;
  onChange: (patch: { createVoucher?: boolean; voucherTemplate?: InvoiceTemplate }) => void;
  previewInput: {
    ownerName: string;
    occurredAt: string;
    amount: string;
    currency: string;
    category: ExpenseCategory;
    customCategoryLabel: string;
    partyLabel: string;
    gstNumber: string;
    gstPercent: number | null;
    notes: string;
    referenceNumber: string;
    isSupplierLinked: boolean;
  };
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const template = voucherTemplate ?? "REGULAR";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Create Voucher?</Label>
        <div className="flex items-center gap-1 rounded-full border border-border p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => onChange({ createVoucher: false })}
            className={cn("rounded-full px-2.5 py-1 font-medium transition-colors", !createVoucher ? "bg-muted text-foreground" : "text-muted-foreground")}
          >
            No
          </button>
          <button
            type="button"
            onClick={() => onChange({ createVoucher: true })}
            className={cn("rounded-full px-2.5 py-1 font-medium transition-colors", createVoucher ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
          >
            Yes
          </button>
        </div>
      </div>

      {createVoucher && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => onChange({ voucherTemplate: t.value })}
                className={cn(
                  "rounded-lg border p-2 text-left transition-colors",
                  template === t.value ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40"
                )}
              >
                <div className="h-12 rounded-md bg-card border border-border overflow-hidden flex flex-col">
                  <div className={cn("h-3", t.swatch)} />
                  <div className="flex-1 p-1 space-y-0.5">
                    <div className="h-1 w-3/4 rounded-full bg-muted-foreground/20" />
                    <div className="h-1 w-1/2 rounded-full bg-muted-foreground/20" />
                  </div>
                </div>
                <p className="text-[11px] font-medium text-foreground mt-1 truncate">{t.label}</p>
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-3.5 w-3.5" /> Preview Voucher
          </Button>
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Voucher Preview</DialogTitle>
          </DialogHeader>
          <InvoiceTemplateRenderer template={template} {...buildExpenseVoucherPreviewProps(previewInput)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
