import { formatMoney } from "@/lib/invoicing/ui";
import type { CalcInvoiceResult } from "@/lib/invoicing/calc";

/** Compact sticky totals bar shown under the edit form (desktop and mobile). */
export function TotalsSummary({ calc, currency }: { calc: CalcInvoiceResult; currency: string }) {
  return (
    <div className="sticky bottom-0 rounded-2xl border border-border bg-card/95 backdrop-blur-sm p-4 shadow-elevated">
      <div className="flex items-center justify-between gap-4 flex-wrap text-xs text-muted-foreground">
        <span>
          Subtotal <span className="text-foreground font-medium tabular-nums">{formatMoney(calc.subtotal, currency)}</span>
        </span>
        <span>
          Tax <span className="text-foreground font-medium tabular-nums">{formatMoney(calc.taxTotal, currency)}</span>
        </span>
        <span className="ml-auto flex items-center gap-2">
          Grand Total
          <span className="text-base font-semibold text-primary tabular-nums">{formatMoney(calc.grandTotal, currency)}</span>
        </span>
      </div>
    </div>
  );
}
