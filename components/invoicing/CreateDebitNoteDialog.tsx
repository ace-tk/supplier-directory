"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/portal/status-badge";
import { listInvoicesAction } from "@/services/invoicing";
import { INVOICE_STATUS_LABELS, formatMoney, formatShortDate } from "@/lib/invoicing/ui";
import type { InvoiceSummary } from "@/types/invoicing";

/**
 * Debit Note is source-dependent (Purchase Invoice -> Debit Note, see
 * lib/invoicing/family.ts VALID_DERIVATION_PAIRS). This picks only the
 * source; the existing derive-from-source flow at
 * /invoices/new?type=DEBIT_NOTE&source=... builds the actual document —
 * same route the invoice detail page's "Create Debit Note" button uses.
 */
export function CreateDebitNoteDialog({ basePath }: { basePath: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const filtered = invoices.filter((inv) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return inv.invoiceNumber.toLowerCase().includes(q) || inv.partyName.toLowerCase().includes(q);
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setSearch("");
  }

  function handleOpen() {
    setOpen(true);
    setLoading(true);
    listInvoicesAction({ types: ["PURCHASE"] }).then((r) => {
      if (r.success) setInvoices(r.data);
      setLoading(false);
    });
  }

  function chooseSource(invoiceId: string) {
    setOpen(false);
    router.push(`${basePath}/new?type=DEBIT_NOTE&source=${invoiceId}`);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button className="gap-1.5" onClick={handleOpen}>
        <Plus className="h-4 w-4" /> Create Debit Note
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Select Source Purchase Invoice</DialogTitle>
          <DialogDescription>Choose the Purchase Invoice this Debit Note applies to.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by invoice number or supplier..." className="pl-8" />
        </div>

        <div className="max-h-80 overflow-y-auto space-y-1.5 -mx-1 px-1">
          {loading ? (
            <div className="h-40 rounded-lg bg-muted/40 animate-pulse" />
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              {invoices.length === 0 ? "No Purchase Invoices found yet." : "No invoices match your search."}
            </p>
          ) : (
            filtered.map((inv) => (
              <button
                key={inv.id}
                type="button"
                onClick={() => chooseSource(inv.id)}
                className="w-full flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
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
      </DialogContent>
    </Dialog>
  );
}
