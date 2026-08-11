"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { setInvoiceStatusAction } from "@/services/invoicing";
import { INVOICE_STATUS_LABELS } from "@/lib/invoicing/ui";
import { ALLOWED_STATUSES_BY_TYPE } from "@/lib/invoicing/status";
import type { InvoiceStatus, InvoiceType } from "@/types/invoicing";

export function StatusChangeMenu({
  invoiceId,
  invoiceType,
  currentStatus,
  onChanged,
}: {
  invoiceId: string;
  invoiceType: InvoiceType;
  currentStatus: InvoiceStatus;
  onChanged: (status: InvoiceStatus) => void;
}) {
  const options = ALLOWED_STATUSES_BY_TYPE[invoiceType];
  const [updating, setUpdating] = useState(false);

  async function handleChange(status: InvoiceStatus) {
    if (status === currentStatus) return;
    setUpdating(true);
    const result = await setInvoiceStatusAction(invoiceId, status);
    setUpdating(false);
    if (!result.success) return toast.error(result.error);
    toast.success(`Status changed to ${INVOICE_STATUS_LABELS[status]}`);
    onChanged(status);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-1.5" disabled={updating} />}>
        {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Change Status <ChevronDown className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((s) => (
          <DropdownMenuItem key={s} onClick={() => handleChange(s)} disabled={s === currentStatus}>
            {INVOICE_STATUS_LABELS[s]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
