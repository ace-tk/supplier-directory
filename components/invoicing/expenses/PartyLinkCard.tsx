"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Building2, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/invoicing/ui";
import { cn } from "@/lib/utils";
import { searchBuyersAction, searchSuppliersAction, getBuyerInvoicesAction, getSupplierPurchasesAction } from "@/services/expenses";
import type { DirectoryOption } from "@/types/invoicing";
import type { PartyInvoiceOption } from "@/types/expense";

type Role = "BUYER" | "SUPPLIER";

const ROLE_CONFIG: Record<
  Role,
  {
    fieldLabel: string;
    fieldHint: string;
    searchAction: (search: string) => Promise<{ success: boolean; data?: DirectoryOption[]; error?: string }>;
    docsAction: (partyUserId: string, search: string, limit: number) => Promise<{ success: boolean; data?: PartyInvoiceOption[]; error?: string }>;
    docsTitle: string;
    docsEmpty: string;
    placeholder: string;
  }
> = {
  BUYER: {
    fieldLabel: "Company / Person",
    fieldHint: "Optional — link to invoices / buyers",
    searchAction: searchBuyersAction,
    docsAction: getBuyerInvoicesAction,
    docsTitle: "Linked Invoices",
    docsEmpty: "No invoices found",
    placeholder: "Search buyers...",
  },
  SUPPLIER: {
    fieldLabel: "Company / Supplier",
    fieldHint: "Optional — link to purchases / suppliers",
    searchAction: searchSuppliersAction,
    docsAction: getSupplierPurchasesAction,
    docsTitle: "Related Purchases",
    docsEmpty: "No purchases found",
    placeholder: "Search suppliers...",
  },
};

export function PartyLinkCard({
  role,
  partyUserId,
  partyLabel,
  documentId,
  onPartyChange,
  onDocumentChange,
}: {
  role: Role;
  partyUserId: string | null;
  partyLabel: string;
  documentId: string | null;
  onPartyChange: (userId: string | null, label: string) => void;
  onDocumentChange: (id: string | null, label: string, partyTaxId?: string | null) => void;
}) {
  const config = ROLE_CONFIG[role];
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<DirectoryOption[]>([]);
  const [docs, setDocs] = useState<PartyInvoiceOption[] | null>(null);
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [viewAllSearch, setViewAllSearch] = useState("");
  const [viewAllDocs, setViewAllDocs] = useState<PartyInvoiceOption[] | null>(null);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      config.searchAction(search).then((r) => {
        if (r.success && r.data) setOptions(r.data);
      });
    }, 200);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, open]);

  // Adjusted during render (not in an effect) when the selected party
  // changes, so the stale list never flashes before the fresh fetch below
  // resolves — see "Adjusting state when a prop changes" in the React docs.
  const [prevPartyUserId, setPrevPartyUserId] = useState(partyUserId);
  if (partyUserId !== prevPartyUserId) {
    setPrevPartyUserId(partyUserId);
    setDocs(null);
  }

  useEffect(() => {
    if (!partyUserId) return;
    let cancelled = false;
    config.docsAction(partyUserId, "", 5).then((r) => {
      if (!cancelled && r.success && r.data) setDocs(r.data);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyUserId]);

  const [prevViewAllOpen, setPrevViewAllOpen] = useState(false);
  if (viewAllOpen !== prevViewAllOpen) {
    setPrevViewAllOpen(viewAllOpen);
    if (viewAllOpen) setViewAllDocs(null);
  }

  useEffect(() => {
    if (!viewAllOpen || !partyUserId) return;
    let cancelled = false;
    const handle = setTimeout(() => {
      config.docsAction(partyUserId, viewAllSearch, 100).then((r) => {
        if (!cancelled && r.success && r.data) setViewAllDocs(r.data);
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewAllOpen, viewAllSearch, partyUserId]);

  function selectDoc(doc: PartyInvoiceOption, closeDialog = false) {
    const deselecting = documentId === doc.id;
    onDocumentChange(deselecting ? null : doc.id, deselecting ? "" : doc.invoiceNumber, deselecting ? null : doc.partyTaxId);
    if (closeDialog) setViewAllOpen(false);
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{config.fieldLabel}</Label>
      <p className="text-[11px] text-muted-foreground -mt-1">{config.fieldHint}</p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button variant="outline" className="w-full justify-between font-normal" />}>
          <span className="flex items-center gap-2 truncate">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {partyLabel || `Select a ${role === "BUYER" ? "buyer" : "supplier"}`}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </PopoverTrigger>
        <PopoverContent className="w-[--anchor-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={config.placeholder} value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>No matches found.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="none"
                  onSelect={() => {
                    onPartyChange(null, "");
                    onDocumentChange(null, "");
                    setOpen(false);
                  }}
                >
                  <Check className={cn("h-3.5 w-3.5", !partyUserId ? "opacity-100" : "opacity-0")} />
                  None
                </CommandItem>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.id}
                    value={opt.id}
                    onSelect={() => {
                      if (opt.id !== partyUserId) {
                        onPartyChange(opt.id, opt.companyName || opt.name);
                        onDocumentChange(null, "");
                      }
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("h-3.5 w-3.5", partyUserId === opt.id ? "opacity-100" : "opacity-0")} />
                    <span className="flex flex-col">
                      <span className="text-foreground">{opt.companyName || opt.name}</span>
                      {opt.companyName && <span className="text-xs text-muted-foreground">{opt.name}</span>}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {partyUserId && (
        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-foreground">{config.docsTitle}</h4>
            <button type="button" className="text-[11px] text-primary hover:underline" onClick={() => setViewAllOpen(true)}>
              View All {role === "BUYER" ? "Invoices" : "Purchases"}
            </button>
          </div>
          {docs === null ? (
            <p className="text-[11px] text-muted-foreground">Loading…</p>
          ) : docs.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">{config.docsEmpty}</p>
          ) : (
            <div className="space-y-1.5">
              {docs.map((doc) => (
                <DocCard key={doc.id} doc={doc} selected={documentId === doc.id} onSelect={() => selectDoc(doc)} />
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={viewAllOpen} onOpenChange={setViewAllOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{config.docsTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={viewAllSearch}
                onChange={(e) => setViewAllSearch(e.target.value)}
                placeholder="Search by invoice number..."
                className="w-full rounded-lg border border-input bg-background pl-8 pr-2 py-1.5 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
            <div className="max-h-80 overflow-y-auto space-y-1.5">
              {viewAllDocs === null ? (
                <p className="text-[11px] text-muted-foreground px-1 py-2">Loading…</p>
              ) : viewAllDocs.length === 0 ? (
                <p className="text-[11px] text-muted-foreground px-1 py-2">{config.docsEmpty}</p>
              ) : (
                viewAllDocs.map((doc) => (
                  <DocCard key={doc.id} doc={doc} selected={documentId === doc.id} onSelect={() => selectDoc(doc, true)} />
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocCard({ doc, selected, onSelect }: { doc: PartyInvoiceOption; selected: boolean; onSelect: () => void }) {
  const dateLabel = new Date(doc.invoiceDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
        selected ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"
      )}
    >
      <span className="min-w-0">
        <span className="block text-xs font-mono font-medium text-foreground truncate">{doc.invoiceNumber}</span>
        <span className="block text-[11px] text-muted-foreground">{dateLabel}</span>
      </span>
      <span className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs font-semibold text-foreground tabular-nums">{formatMoney(doc.grandTotal, doc.currency)}</span>
        {selected ? <X className="h-3.5 w-3.5 text-primary" /> : <Check className="h-3.5 w-3.5 opacity-0" />}
      </span>
    </button>
  );
}
