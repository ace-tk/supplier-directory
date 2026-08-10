"use client";

import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { INVOICE_TYPE_LABELS } from "@/lib/invoicing/ui";
import type { InvoiceFamily } from "@/lib/invoicing/family";
import type { InvoiceType } from "@/types/invoicing";

// Only standalone-creatable types belong here — Credit Note/Sales
// Return/Debit Note are only ever created from an existing source
// document's detail-page Actions (see InvoiceDetail.tsx), never from this
// menu, per the explicit per-exact-type gating requirement.
const FAMILY_CREATE_TYPES: Record<InvoiceFamily, InvoiceType[]> = {
  SALES: ["SALES", "QUOTATION"],
  PURCHASE: ["PURCHASE"],
};

export function CreateDocumentMenu({ basePath, family }: { basePath: string; family: InvoiceFamily }) {
  const types = FAMILY_CREATE_TYPES[family];

  if (types.length === 1) {
    return (
      <Button className="gap-1.5" render={<Link href={`${basePath}/new?type=${types[0]}`} />} nativeButton={false}>
        <Plus className="h-4 w-4" /> Create {INVOICE_TYPE_LABELS[types[0]]}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button className="gap-1.5" />}>
        <Plus className="h-4 w-4" /> Create <ChevronDown className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {types.map((t) => (
          <DropdownMenuItem key={t} render={<Link href={`${basePath}/new?type=${t}`} />}>
            {INVOICE_TYPE_LABELS[t]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
