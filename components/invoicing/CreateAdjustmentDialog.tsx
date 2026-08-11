"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileMinus, Plus, Search, Undo2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/portal/status-badge";
import { listInvoicesAction } from "@/services/invoicing";
import { INVOICE_STATUS_LABELS, formatMoney, formatShortDate } from "@/lib/invoicing/ui";
import { cn } from "@/lib/utils";
import type { InvoiceSummary } from "@/types/invoicing";

type AdjustmentType = "CREDIT_NOTE" | "SALES_RETURN";

const TYPE_OPTIONS: { type: AdjustmentType; label: string; description: string; icon: typeof FileMinus }[] = [
  { type: "CREDIT_NOTE", label: "Credit Note", description: "Reduce what a buyer owes — price correction, discount, or billing error.", icon: FileMinus },
  { type: "SALES_RETURN", label: "Sales Return", description: "Record goods a buyer sent back against an invoice.", icon: Undo2 },
];

/**
 * Credit Note/Sales Return are source-dependent (see lib/invoicing/family.ts
 * VALID_DERIVATION_PAIRS). This wizard only picks the type + source
 * invoice; the actual document is built by the existing derive-from-source
 * flow at /invoices/new?type=...&source=... (same route the invoice
 * detail page's "Create Credit Note" button already uses) — no new
 * creation logic here.
 */
export function CreateAdjustmentDialog({ basePath }: { basePath: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"type" | "source">("type");
  const [selectedType, setSelectedType] = useState<AdjustmentType | null>(null);
  const [search, setSearch] = useState("");
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState(false);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setStep("type");
      setSelectedType(null);
      setSearch("");
    }
  }

  const filtered = invoices.filter((inv) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return inv.invoiceNumber.toLowerCase().includes(q) || inv.partyName.toLowerCase().includes(q);
  });

  function chooseType(type: AdjustmentType) {
    setSelectedType(type);
    setStep("source");
    setLoading(true);
    listInvoicesAction({ types: ["SALES"] }).then((r) => {
      if (r.success) setInvoices(r.data);
      setLoading(false);
    });
  }

  function chooseSource(invoiceId: string) {
    if (!selectedType) return;
    setOpen(false);
    router.push(`${basePath}/new?type=${selectedType}&source=${invoiceId}`);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Create Credit Note / Sales Return
      </Button>
      <DialogContent className="sm:max-w-lg">
        {step === "type" ? (
          <>
            <DialogHeader>
              <DialogTitle>Select Document Type</DialogTitle>
              <DialogDescription>Both are created against an existing Tax Invoice.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => chooseType(opt.type)}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
                >
                  <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <opt.icon className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep("type")}
                  aria-label="Back"
                  className="text-muted-foreground hover:text-foreground -ml-1 p-1 rounded-md hover:bg-muted"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <DialogTitle>Select Source Tax Invoice</DialogTitle>
              </div>
              <DialogDescription>
                Choose the Tax Invoice this {selectedType === "CREDIT_NOTE" ? "Credit Note" : "Sales Return"} applies to.
              </DialogDescription>
            </DialogHeader>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by invoice number or buyer..." className="pl-8" />
            </div>

            <div className="max-h-80 overflow-y-auto space-y-1.5 -mx-1 px-1">
              {loading ? (
                <div className="h-40 rounded-lg bg-muted/40 animate-pulse" />
              ) : filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  {invoices.length === 0 ? "No Tax Invoices found yet." : "No invoices match your search."}
                </p>
              ) : (
                filtered.map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => chooseSource(inv.id)}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-foreground">{inv.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground truncate">{inv.partyName}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground">{formatShortDate(inv.invoiceDate)}</span>
                      <span className="text-xs tabular-nums text-foreground">{formatMoney(inv.grandTotal, inv.currency)}</span>
                      <StatusBadge status={INVOICE_STATUS_LABELS[inv.status]} />
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
